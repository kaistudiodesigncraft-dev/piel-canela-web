begin;

drop function if exists public.create_admin_booking_for_selection(
  uuid, uuid, uuid, timestamptz, public.booking_status, uuid, text, text, text, text, text, uuid
);

create function public.create_admin_booking_for_selection(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_monthly_special_id uuid,
  requested_starts_at timestamptz,
  requested_status public.booking_status,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text,
  customer_notes text,
  internal_notes text,
  requested_extra_ids uuid[] default '{}'::uuid[],
  requested_professional_id uuid default null
)
returns table (booking_id uuid, booking_code text, booking_status public.booking_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected record;
  new_customer_id uuid;
  new_booking public.bookings%rowtype;
  requested_local_date date;
  assigned_professional uuid;
  computed_ends_at timestamptz;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if requested_status not in ('pending','awaiting_deposit','confirmed') then
    raise exception using errcode = '22023', message = 'invalid_initial_status';
  end if;
  if requested_starts_at < now() - interval '15 minutes' then
    raise exception using errcode = '22023', message = 'booking_must_be_current_or_future';
  end if;
  if char_length(trim(customer_full_name)) not between 2 and 100
    or char_length(trim(customer_phone)) not between 8 and 30
    or (customer_email is not null and char_length(trim(customer_email)) > 180)
    or (customer_notes is not null and char_length(trim(customer_notes)) > 240)
    or (internal_notes is not null and char_length(trim(internal_notes)) > 1000) then
    raise exception using errcode = '22023', message = 'invalid_booking_data';
  end if;

  select * into new_booking from public.bookings where idempotency_key = requested_idempotency_key;
  if found then return query select new_booking.id, new_booking.booking_code, new_booking.status; return; end if;

  select * into selected
  from public.resolve_booking_selection_v2(
    requested_treatment_id,
    requested_combo_id,
    requested_monthly_special_id,
    coalesce(requested_extra_ids, '{}'::uuid[])
  );
  computed_ends_at := requested_starts_at + make_interval(mins => selected.duration_minutes + selected.buffer_minutes);
  assigned_professional := public.auto_assign_professional_for_booking(
    selected.treatment_id, requested_starts_at, computed_ends_at, requested_professional_id
  );

  requested_local_date := (requested_starts_at at time zone 'America/Argentina/Cordoba')::date;
  if not exists (
    select 1 from public.get_available_slots_for_selection_v2(
      requested_treatment_id, requested_combo_id, requested_local_date,
      coalesce(requested_extra_ids, '{}'::uuid[])
    ) slot where slot.starts_at = requested_starts_at
  ) then raise exception using errcode = '23P01', message = 'slot_not_available'; end if;

  insert into public.customers(full_name, phone, email)
  values (trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), ''))
  returning id into new_customer_id;

  insert into public.bookings(
    idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    monthly_special_id, treatment_combo_id, starts_at, ends_at,
    duration_snapshot_minutes, buffer_snapshot_minutes, base_price_snapshot_cents,
    applied_price_snapshot_cents, treatment_name_snapshot, customer_notes, internal_notes,
    combo_name_snapshot, combo_mode_snapshot, combo_audience_snapshot, combo_zones_snapshot,
    combo_extras_snapshot, combo_pricing_mode_snapshot, combo_discount_snapshot,
    combo_session_count_snapshot, combo_validity_days_snapshot, combo_reference_price_snapshot_cents,
    combo_price_per_session_snapshot_cents, combo_savings_snapshot_cents,
    package_charge_kind, status, confirmed_at, deposit_confirmed_at, status_changed_at, status_changed_by
  ) values (
    requested_idempotency_key, new_customer_id, selected.treatment_id, selected.specialty_id, assigned_professional,
    requested_monthly_special_id, selected.combo_id, requested_starts_at, computed_ends_at,
    selected.duration_minutes, selected.buffer_minutes, selected.base_price_cents,
    selected.applied_price_cents, selected.treatment_name, nullif(trim(customer_notes), ''), nullif(trim(internal_notes), ''),
    selected.combo_name, selected.combo_mode, selected.combo_audience, selected.zones,
    selected.extras, selected.pricing_mode, selected.discount,
    selected.session_count, selected.validity_days, selected.base_price_cents,
    selected.price_per_session_cents, selected.savings_cents,
    case when selected.combo_mode = 'package' then 'package_initial' else 'standard' end,
    requested_status, case when requested_status = 'confirmed' then now() end,
    case when requested_status = 'confirmed' then now() end, now(), auth.uid()
  ) returning * into new_booking;

  insert into public.booking_status_history(booking_id, previous_status, next_status, reason, actor_id)
  values (new_booking.id, null, requested_status, 'Turno asignado manualmente', auth.uid());

  return query select new_booking.id, new_booking.booking_code, new_booking.status;
exception
  when exclusion_violation then raise exception using errcode = '23P01', message = 'slot_not_available';
  when unique_violation then
    return query select booking.id, booking.booking_code, booking.status from public.bookings booking
    where booking.idempotency_key = requested_idempotency_key;
    if not found then raise; end if;
end;
$$;

revoke all on function public.create_admin_booking_for_selection(
  uuid, uuid, uuid, timestamptz, public.booking_status, uuid, text, text, text, text, text, uuid[], uuid
) from public, anon;
grant execute on function public.create_admin_booking_for_selection(
  uuid, uuid, uuid, timestamptz, public.booking_status, uuid, text, text, text, text, text, uuid[], uuid
) to authenticated;

commit;
