-- Sprint 0: keep every administrative booking path aligned with recurring
-- treatment dates and the public Depilation quote. This migration only adds
-- RPCs; it does not rewrite catalog, customer, booking or media rows.
begin;

create or replace function public.get_available_slots_for_reschedule_v2(
  requested_booking_id uuid,
  requested_date date
) returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare treatment_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select booking.treatment_id into treatment_id
  from public.bookings booking where booking.id = requested_booking_id;
  if treatment_id is null then
    raise exception using errcode = 'P0002', message = 'booking_not_found';
  end if;
  if not public.is_treatment_offered_on_date(treatment_id, requested_date) then
    return;
  end if;
  return query select slot.starts_at, slot.ends_at
  from public.get_available_slots_for_reschedule(requested_booking_id, requested_date) slot;
end;
$$;

revoke all on function public.get_available_slots_for_reschedule_v2(uuid,date) from public,anon;
grant execute on function public.get_available_slots_for_reschedule_v2(uuid,date) to authenticated;

create or replace function public.get_available_slots_for_package_v2(
  requested_package_id uuid,
  requested_date date
) returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare treatment_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select customer_package.treatment_id into treatment_id
  from public.customer_packages customer_package where customer_package.id = requested_package_id;
  if treatment_id is null then
    raise exception using errcode = 'P0002', message = 'package_not_available';
  end if;
  if not public.is_treatment_offered_on_date(treatment_id, requested_date) then
    return;
  end if;
  return query select slot.starts_at, slot.ends_at
  from public.get_available_slots_for_package(requested_package_id, requested_date) slot;
end;
$$;

revoke all on function public.get_available_slots_for_package_v2(uuid,date) from public,anon;
grant execute on function public.get_available_slots_for_package_v2(uuid,date) to authenticated;

create or replace function public.get_admin_available_slots_for_zone_order(
  payload text,
  signature text,
  requested_date date,
  requested_professional_id uuid default null
) returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare quote jsonb; treatment_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  quote := private.verify_depilation_quote(payload, signature);
  treatment_id := (quote->'context'->>'treatmentId')::uuid;
  if not public.is_treatment_offered_on_date(treatment_id, requested_date) then
    return;
  end if;
  return query
  select slot.starts_at, slot.ends_at
  from public.get_available_slots_for_zone_order(payload, signature, requested_date) slot
  where public.find_available_professional_for_booking(
    treatment_id, slot.starts_at, slot.ends_at, requested_professional_id
  ) is not null
  order by slot.starts_at;
end;
$$;

revoke all on function public.get_admin_available_slots_for_zone_order(text,text,date,uuid) from public,anon;
grant execute on function public.get_admin_available_slots_for_zone_order(text,text,date,uuid) to authenticated;

create or replace function public.create_admin_booking_for_zone_order(
  payload text,
  signature text,
  requested_starts_at timestamptz,
  requested_status public.booking_status,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text,
  customer_notes text,
  internal_notes text,
  requested_professional_id uuid default null
) returns table(booking_id uuid, booking_code text, booking_status public.booking_status)
language plpgsql security definer set search_path = '' as $$
declare
  quote jsonb; context jsonb; order_snapshot jsonb;
  new_customer_id uuid; new_booking public.bookings%rowtype;
  selected_treatment_id uuid; selected_combo_id uuid; assigned_professional uuid;
  computed_ends_at timestamptz; booking_timezone text; requested_local_date date;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if requested_status not in ('pending','awaiting_deposit','confirmed') then
    raise exception using errcode = '22023', message = 'invalid_initial_status';
  end if;
  if requested_idempotency_key is null or requested_starts_at is null
    or requested_starts_at < now() - interval '15 minutes' then
    raise exception using errcode = '22023', message = 'booking_must_be_current_or_future';
  end if;
  if customer_full_name is null or char_length(trim(customer_full_name)) not between 2 and 100
    or customer_phone is null or char_length(trim(customer_phone)) not between 8 and 30
    or length(coalesce(customer_email,'')) > 180
    or length(coalesce(customer_notes,'')) > 240
    or length(coalesce(internal_notes,'')) > 1000 then
    raise exception using errcode = '22023', message = 'invalid_booking_data';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(requested_idempotency_key::text, 0));
  select * into new_booking from public.bookings where idempotency_key = requested_idempotency_key;
  if found then
    return query select new_booking.id, new_booking.booking_code, new_booking.status;
    return;
  end if;

  quote := private.verify_depilation_quote(payload, signature);
  context := quote->'context';
  order_snapshot := quote->'order';
  selected_treatment_id := (context->>'treatmentId')::uuid;
  selected_combo_id := (context->'combo'->>'id')::uuid;

  -- Lock every quoted input and verify once more so prices cannot change
  -- between availability confirmation and the booking snapshot.
  perform 1 from public.business_settings where singleton for share;
  select timezone into booking_timezone from public.business_settings where singleton;
  perform 1 from public.treatments where id = selected_treatment_id for share;
  perform 1 from public.treatment_combos where id = selected_combo_id for share;
  perform 1 from public.treatment_combo_zones link where link.combo_id = selected_combo_id order by link.zone_id for share;
  perform 1 from public.depilation_zones zone where zone.id in (
    select value::uuid from jsonb_array_elements_text(quote->'zoneIds') value
    union
    select link.zone_id from public.treatment_combo_zones link where link.combo_id = selected_combo_id
  ) order by zone.id for share;
  quote := private.verify_depilation_quote(payload, signature);
  context := quote->'context';
  order_snapshot := quote->'order';

  requested_local_date := (requested_starts_at at time zone booking_timezone)::date;
  if not public.is_treatment_offered_on_date(selected_treatment_id, requested_local_date) then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  end if;
  computed_ends_at := requested_starts_at
    + make_interval(mins => (order_snapshot->>'durationMinutes')::int + (context->>'bufferMinutes')::int);
  assigned_professional := public.auto_assign_professional_for_booking(
    selected_treatment_id, requested_starts_at, computed_ends_at, requested_professional_id
  );
  if assigned_professional is null then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  end if;
  if not exists (
    select 1 from public.get_admin_available_slots_for_zone_order(
      payload, signature, requested_local_date, requested_professional_id
    ) slot where slot.starts_at = requested_starts_at
  ) then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  end if;

  insert into public.customers(full_name, phone, email)
  values(trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), ''))
  returning id into new_customer_id;

  insert into public.bookings(
    idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    starts_at, ends_at, duration_snapshot_minutes, buffer_snapshot_minutes,
    base_price_snapshot_cents, applied_price_snapshot_cents, treatment_name_snapshot,
    customer_notes, internal_notes, treatment_combo_id, combo_name_snapshot,
    combo_mode_snapshot, combo_audience_snapshot, combo_zones_snapshot, combo_extras_snapshot,
    combo_session_count_snapshot, combo_validity_days_snapshot,
    combo_reference_price_snapshot_cents, combo_price_per_session_snapshot_cents,
    combo_savings_snapshot_cents, combo_discount_snapshot, package_charge_kind,
    depilation_order_snapshot, status, confirmed_at, deposit_confirmed_at,
    status_changed_at, status_changed_by
  ) values (
    requested_idempotency_key, new_customer_id, selected_treatment_id,
    (context->>'specialtyId')::uuid, assigned_professional,
    requested_starts_at, computed_ends_at, (order_snapshot->>'durationMinutes')::int,
    (context->>'bufferMinutes')::int, (order_snapshot->>'subtotalCents')::int,
    (order_snapshot->>'totalCents')::int, context->>'treatmentName',
    nullif(trim(customer_notes), ''), nullif(trim(internal_notes), ''), selected_combo_id,
    context->'combo'->>'name', (context->>'comboMode')::public.combo_mode,
    (context->>'comboAudience')::public.depilation_audience,
    case when selected_combo_id is null then context->'zones' else context->'includedZones' end,
    case when selected_combo_id is null then '[]'::jsonb else context->'zones' end,
    coalesce((context->'combo'->>'sessionCount')::int, 1), (context->>'validityDays')::int,
    (order_snapshot->>'subtotalCents')::int,
    round((order_snapshot->>'totalCents')::numeric / coalesce((context->'combo'->>'sessionCount')::int, 1))::int,
    (order_snapshot->>'discountCents')::int,
    jsonb_build_object('discountPercent', order_snapshot->'discountPercent', 'discountCents', order_snapshot->'discountCents'),
    case when context->>'comboMode' = 'package' then 'package_initial' else 'standard' end,
    jsonb_build_object('version', 1, 'context', context, 'order', order_snapshot),
    requested_status, case when requested_status = 'confirmed' then now() end,
    case when requested_status = 'confirmed' then now() end, now(), auth.uid()
  ) returning * into new_booking;

  insert into public.booking_status_history(booking_id, previous_status, next_status, reason, actor_id)
  values(new_booking.id, null, requested_status, 'Turno asignado manualmente', auth.uid());

  return query select new_booking.id, new_booking.booking_code, new_booking.status;
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  when unique_violation then
    return query select booking.id, booking.booking_code, booking.status
    from public.bookings booking where booking.idempotency_key = requested_idempotency_key;
    if not found then raise; end if;
end;
$$;

revoke all on function public.create_admin_booking_for_zone_order(
  text,text,timestamptz,public.booking_status,uuid,text,text,text,text,text,uuid
) from public,anon;
grant execute on function public.create_admin_booking_for_zone_order(
  text,text,timestamptz,public.booking_status,uuid,text,text,text,text,text,uuid
) to authenticated;

commit;

-- Reversible rollback (does not touch stored data):
-- drop function if exists public.create_admin_booking_for_zone_order(text,text,timestamptz,public.booking_status,uuid,text,text,text,text,text,uuid);
-- drop function if exists public.get_admin_available_slots_for_zone_order(text,text,date,uuid);
-- drop function if exists public.get_available_slots_for_package_v2(uuid,date);
-- drop function if exists public.get_available_slots_for_reschedule_v2(uuid,date);
