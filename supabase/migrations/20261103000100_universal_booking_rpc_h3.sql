-- H3: signed, generic booking RPC for treatments explicitly opted into H2.
-- Additive only. Legacy Depilation functions, policies and tables remain untouched.

alter table public.bookings
  add column treatment_option_combo_id uuid
    references public.treatment_option_combos(id) on delete restrict,
  add column booking_order_v2_snapshot jsonb,
  add constraint bookings_order_v2_snapshot_shape check (
    booking_order_v2_snapshot is null
    or (
      jsonb_typeof(booking_order_v2_snapshot) = 'object'
      and booking_order_v2_snapshot @> '{"version": 1, "purpose": "booking-order-v2"}'::jsonb
    )
  ),
  add constraint bookings_order_v2_combo_snapshot check (
    treatment_option_combo_id is null or booking_order_v2_snapshot is not null
  );

create index bookings_treatment_option_combo_idx
  on public.bookings(treatment_option_combo_id)
  where treatment_option_combo_id is not null;

comment on column public.bookings.treatment_option_combo_id is
  'Optional neutral combination selected through the booking-order-v2 flow.';
comment on column public.bookings.booking_order_v2_snapshot is
  'Immutable server-authoritative snapshot for a configurable booking.';

create or replace function public.get_booking_order_context_v2(
  requested_treatment_id uuid,
  requested_combination_id uuid default null,
  requested_option_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_treatment public.treatments%rowtype;
  selected_combination public.treatment_option_combos%rowtype;
  selected_options jsonb := '[]'::jsonb;
  selected_option_versions jsonb := '[]'::jsonb;
  included_options jsonb := '[]'::jsonb;
  included_option_ids jsonb := '[]'::jsonb;
  allowed_addon_ids jsonb := '[]'::jsonb;
  relation_versions jsonb := '[]'::jsonb;
  combination_payload jsonb;
  context_payload jsonb;
begin
  if requested_treatment_id is null
    or requested_option_ids is null
    or cardinality(requested_option_ids) > 100
    or cardinality(requested_option_ids) <> (
      select count(distinct option_id) from unnest(requested_option_ids) as option_id
    ) then
    raise exception using errcode = '22023', message = 'invalid_options';
  end if;

  select * into selected_treatment
  from public.treatments treatment
  where treatment.id = requested_treatment_id
    and treatment.is_active;

  if selected_treatment.id is null then
    raise exception using errcode = '22023', message = 'treatment_not_available';
  end if;
  if selected_treatment.config_enabled is distinct from true then
    raise exception using errcode = '22023', message = 'legacy_flow_required';
  end if;
  if selected_treatment.booking_config is null
    or selected_treatment.booking_config->>'version' is distinct from '1' then
    raise exception using errcode = '22023', message = 'booking_config_invalid';
  end if;
  if selected_treatment.booking_config->>'mode' = 'package' then
    raise exception using errcode = '0A000', message = 'package_flow_not_enabled';
  end if;
  if not exists (
    select 1 from public.specialties specialty
    where specialty.id = selected_treatment.specialty_id and specialty.is_active
  ) or not exists (
    select 1 from public.treatment_categories category
    where category.id = selected_treatment.category_id and category.is_active
  ) then
    raise exception using errcode = '22023', message = 'treatment_not_available';
  end if;

  if requested_combination_id is not null then
    select * into selected_combination
    from public.treatment_option_combos combination
    where combination.id = requested_combination_id
      and combination.treatment_id = selected_treatment.id
      and combination.is_active
      and combination.price_cents > 0;
    if selected_combination.id is null then
      raise exception using errcode = '22023', message = 'combination_unavailable';
    end if;

    if exists (
      select 1
      from public.treatment_option_combo_items item
      join public.treatment_options option on option.id = item.option_id
      where item.combo_id = selected_combination.id
        and item.treatment_id = selected_treatment.id
        and (not option.is_active or option.price_cents <= 0)
    ) then
      raise exception using errcode = '22023', message = 'combination_unavailable';
    end if;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', option.id,
          'name', option.name,
          'priceCents', option.price_cents,
          'durationMinutes', option.duration_minutes
        ) order by item.display_order, option.name, option.id
      ) filter (where item.role = 'included'), '[]'::jsonb),
      coalesce(jsonb_agg(to_jsonb(option.id) order by item.display_order, option.name, option.id)
        filter (where item.role = 'included'), '[]'::jsonb),
      coalesce(jsonb_agg(to_jsonb(option.id) order by item.display_order, option.name, option.id)
        filter (where item.role = 'addon'), '[]'::jsonb),
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'optionId', item.option_id,
          'role', item.role,
          'updatedAt', item.updated_at,
          'optionUpdatedAt', option.updated_at
        ) order by item.id
      ), '[]'::jsonb)
    into included_options, included_option_ids, allowed_addon_ids, relation_versions
    from public.treatment_option_combo_items item
    join public.treatment_options option on option.id = item.option_id
    where item.combo_id = selected_combination.id
      and item.treatment_id = selected_treatment.id;

    combination_payload := jsonb_build_object(
      'id', selected_combination.id,
      'name', selected_combination.name,
      'kind', selected_combination.kind,
      'priceCents', selected_combination.price_cents,
      'durationMinutes', selected_combination.duration_minutes,
      'includedOptionIds', included_option_ids,
      'allowedAddonOptionIds', allowed_addon_ids,
      'sessionCount', selected_combination.session_count
    );
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', option.id,
        'name', option.name,
        'priceCents', option.price_cents,
        'durationMinutes', option.duration_minutes,
        'displayOrder', option.display_order,
        'isActive', option.is_active
      ) order by option.id
    ), '[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object('id', option.id, 'updatedAt', option.updated_at)
      order by option.id
    ), '[]'::jsonb)
  into selected_options, selected_option_versions
  from public.treatment_options option
  where option.id = any(requested_option_ids)
    and option.treatment_id = selected_treatment.id
    and option.is_active
    and option.price_cents > 0;

  if jsonb_array_length(selected_options) <> cardinality(requested_option_ids) then
    raise exception using errcode = '22023', message = 'option_unavailable';
  end if;

  context_payload := jsonb_build_object(
    'source', 'configured',
    'treatmentId', selected_treatment.id,
    'treatmentName', selected_treatment.name,
    'specialtyId', selected_treatment.specialty_id,
    'requiresProfessionalAssignment', selected_treatment.requires_professional_assignment,
    'bufferMinutes', selected_treatment.buffer_minutes,
    'startIntervalMinutes', selected_treatment.start_interval_minutes,
    'bookingConfig', selected_treatment.booking_config,
    'selection', jsonb_build_object(
      'combinationId', requested_combination_id,
      'optionIds', to_jsonb(requested_option_ids)
    ),
    'combination', combination_payload,
    'options', selected_options,
    'includedOptions', included_options,
    'version', md5(jsonb_build_array(
      selected_treatment.updated_at,
      selected_combination.updated_at,
      selected_option_versions,
      relation_versions
    )::text)
  );
  return context_payload;
end;
$$;

create or replace function private.verify_booking_order_quote_v2(
  payload text,
  signature text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  quote jsonb;
  stored_secret_hash text;
  current_context jsonb;
  option_ids uuid[];
  combination_id uuid;
  order_payload jsonb;
begin
  if payload is null or length(payload) > 100000
    or signature is null or signature !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_quote';
  end if;
  select config.secret_hash into stored_secret_hash
  from private.booking_guard_config config where config.singleton;
  if stored_secret_hash is null
    or encode(extensions.hmac(
      convert_to(payload, 'UTF8'), convert_to(stored_secret_hash, 'UTF8'), 'sha256'
    ), 'hex') <> signature then
    raise exception using errcode = '22023', message = 'invalid_quote';
  end if;

  quote := payload::jsonb;
  if quote->>'purpose' is distinct from 'booking-order-v2'
    or quote->>'expiresAt' is null
    or (quote->>'expiresAt')::timestamptz < now()
    or (quote->>'expiresAt')::timestamptz > now() + interval '16 minutes'
    or jsonb_typeof(quote->'selection') is distinct from 'object'
    or jsonb_typeof(quote->'selection'->'optionIds') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'quote_expired';
  end if;

  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into option_ids
  from jsonb_array_elements_text(quote->'selection'->'optionIds') as value;
  combination_id := nullif(quote->'selection'->>'combinationId', '')::uuid;
  current_context := public.get_booking_order_context_v2(
    (quote->'context'->>'treatmentId')::uuid,
    combination_id,
    option_ids
  );
  if current_context is distinct from quote->'context' then
    raise exception using errcode = '22023', message = 'quote_changed';
  end if;

  order_payload := quote->'order';
  if jsonb_typeof(order_payload) is distinct from 'object'
    or jsonb_typeof(order_payload->'items') is distinct from 'array'
    or (order_payload->>'subtotalCents')::bigint <= 0
    or (order_payload->>'discountCents')::bigint < 0
    or (order_payload->>'totalCents')::bigint < 0
    or (order_payload->>'totalCents')::bigint
      <> (order_payload->>'subtotalCents')::bigint - (order_payload->>'discountCents')::bigint
    or (order_payload->>'subtotalCents')::bigint > 2147483647
    or (order_payload->>'totalCents')::bigint > 2147483647
    or (order_payload->>'durationMinutes')::integer not between 5 and 480 then
    raise exception using errcode = '22023', message = 'invalid_quote';
  end if;
  return quote;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'invalid_quote';
end;
$$;

create or replace function public.get_available_slots_for_booking_order_v2(
  payload text,
  signature text,
  requested_date date
)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified jsonb;
  selected_treatment_id uuid;
  selected_specialty_id uuid;
  occupied_minutes integer;
  interval_minutes integer;
  requires_professional boolean;
begin
  perform public.expire_pending_bookings();
  verified := private.verify_booking_order_quote_v2(payload, signature);
  selected_treatment_id := (verified->'context'->>'treatmentId')::uuid;
  selected_specialty_id := (verified->'context'->>'specialtyId')::uuid;
  occupied_minutes := (verified->'order'->>'durationMinutes')::integer
    + (verified->'context'->>'bufferMinutes')::integer;
  interval_minutes := (verified->'context'->>'startIntervalMinutes')::integer;
  requires_professional := (verified->'context'->>'requiresProfessionalAssignment')::boolean;

  if requested_date is null or not public.is_treatment_offered_on_date(selected_treatment_id, requested_date) then
    return;
  end if;

  return query
  with config as (
    select settings.timezone, settings.minimum_notice_minutes, settings.maximum_advance_days
    from public.business_settings settings where settings.singleton
  ), windows as (
    select
      (requested_date + rule.start_time) at time zone config.timezone as window_start,
      (requested_date + rule.end_time) at time zone config.timezone as window_end
    from config
    join public.availability_rules rule
      on rule.specialty_id = selected_specialty_id
      and rule.weekday = extract(dow from requested_date)::smallint
      and rule.is_active
    union all
    select exception.starts_at, exception.ends_at
    from public.availability_exceptions exception
    cross join config
    where exception.specialty_id = selected_specialty_id
      and exception.kind = 'open'
      and (exception.starts_at at time zone config.timezone)::date = requested_date
  ), candidates as (
    select
      candidate_start,
      candidate_start + make_interval(mins => occupied_minutes) as candidate_end
    from windows
    cross join lateral generate_series(
      windows.window_start,
      windows.window_end - make_interval(mins => occupied_minutes),
      make_interval(mins => interval_minutes)
    ) as candidate_start
  )
  select distinct candidates.candidate_start, candidates.candidate_end
  from candidates
  cross join config
  where candidates.candidate_start >= now() + make_interval(mins => config.minimum_notice_minutes)
    and requested_date <= (now() at time zone config.timezone)::date + config.maximum_advance_days
    and not exists (
      select 1 from public.availability_exceptions exception
      where exception.specialty_id = selected_specialty_id
        and exception.kind = 'blocked'
        and tstzrange(exception.starts_at, exception.ends_at, '[)')
          && tstzrange(candidates.candidate_start, candidates.candidate_end, '[)')
    )
    and (
      not requires_professional
      or public.find_available_professional_for_booking(
        selected_treatment_id, candidates.candidate_start, candidates.candidate_end, null
      ) is not null
    )
  order by candidates.candidate_start;
end;
$$;

create or replace function public.get_available_dates_for_booking_order_v2(
  payload text,
  signature text,
  requested_from_date date,
  requested_to_date date
)
returns table(available_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified jsonb;
  treatment_id uuid;
begin
  if requested_from_date is null or requested_to_date is null
    or requested_to_date < requested_from_date
    or requested_to_date > requested_from_date + 366 then
    raise exception using errcode = '22023', message = 'invalid_date_range';
  end if;
  verified := private.verify_booking_order_quote_v2(payload, signature);
  treatment_id := (verified->'context'->>'treatmentId')::uuid;
  return query
  select candidate.day::date
  from generate_series(requested_from_date, requested_to_date, interval '1 day') candidate(day)
  where public.is_treatment_offered_on_date(treatment_id, candidate.day::date)
    and exists (
      select 1 from public.get_available_slots_for_booking_order_v2(
        payload, signature, candidate.day::date
      ) limit 1
    )
  order by candidate.day;
end;
$$;

create or replace function public.create_booking_for_booking_order_v2(
  payload text,
  signature text,
  requested_starts_at timestamptz,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text default null,
  customer_notes text default null,
  request_guard_nonce uuid default null,
  request_guard_fingerprint text default null,
  request_guard_secret text default null
)
returns table(booking_id uuid, booking_code text, status public.booking_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  verified jsonb;
  context_payload jsonb;
  order_payload jsonb;
  selected_booking public.bookings%rowtype;
  new_customer_id uuid;
  assigned_professional uuid;
  treatment_id uuid;
  combination_id uuid;
  option_ids uuid[];
  calculated_end timestamptz;
  booking_timezone text;
  stored_guard_hash text;
  nonce_rows integer;
  attempt_count integer;
begin
  if requested_idempotency_key is null or requested_starts_at is null then
    raise exception using errcode = '22023', message = 'invalid_booking_request';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_idempotency_key::text, 0));
  select * into selected_booking
  from public.bookings booking where booking.idempotency_key = requested_idempotency_key;
  if found then
    return query select selected_booking.id, selected_booking.booking_code, selected_booking.status;
    return;
  end if;

  select config.secret_hash into stored_guard_hash
  from private.booking_guard_config config where config.singleton;
  if stored_guard_hash is null or request_guard_secret is null
    or char_length(request_guard_secret) < 32
    or encode(extensions.digest(request_guard_secret, 'sha256'), 'hex') <> stored_guard_hash
    or request_guard_nonce is null
    or request_guard_fingerprint is null
    or request_guard_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '42501', message = 'booking_guard_invalid';
  end if;

  verified := private.verify_booking_order_quote_v2(payload, signature);
  context_payload := verified->'context';
  order_payload := verified->'order';
  treatment_id := (context_payload->>'treatmentId')::uuid;
  combination_id := nullif(verified->'selection'->>'combinationId', '')::uuid;
  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into option_ids
  from jsonb_array_elements_text(verified->'selection'->'optionIds') as value;

  perform 1 from public.treatments where id = treatment_id for share;
  if combination_id is not null then
    perform 1 from public.treatment_option_combos where id = combination_id for share;
    perform 1 from public.treatment_option_combo_items
      where combo_id = combination_id order by option_id for share;
  end if;
  perform 1 from public.treatment_options option
  where option.id = any(option_ids)
    or exists (
      select 1 from public.treatment_option_combo_items item
      where item.combo_id = combination_id and item.option_id = option.id
    )
  order by option.id for share;
  verified := private.verify_booking_order_quote_v2(payload, signature);
  context_payload := verified->'context';
  order_payload := verified->'order';

  if customer_full_name is null or char_length(trim(customer_full_name)) not between 2 and 100
    or customer_phone is null or char_length(trim(customer_phone)) not between 8 and 30
    or char_length(coalesce(customer_email, '')) > 180
    or char_length(coalesce(customer_notes, '')) > 240 then
    raise exception using errcode = '22023', message = 'invalid_customer_data';
  end if;

  insert into private.booking_guard_nonces(nonce, fingerprint)
  values(request_guard_nonce, request_guard_fingerprint)
  on conflict do nothing;
  get diagnostics nonce_rows = row_count;
  if nonce_rows <> 1 then
    raise exception using errcode = '42501', message = 'booking_guard_replayed';
  end if;

  insert into private.booking_rate_limits as limits(fingerprint, window_started_at, attempts, updated_at)
  values(request_guard_fingerprint, now(), 1, now())
  on conflict(fingerprint) do update set
    attempts = case when limits.window_started_at <= now() - interval '1 hour'
      then 1 else limits.attempts + 1 end,
    window_started_at = case when limits.window_started_at <= now() - interval '1 hour'
      then now() else limits.window_started_at end,
    updated_at = now()
  returning limits.attempts into attempt_count;
  if attempt_count > 6 then
    raise exception using errcode = 'P0001', message = 'booking_rate_limited';
  end if;

  calculated_end := requested_starts_at + make_interval(
    mins => (order_payload->>'durationMinutes')::integer
      + (context_payload->>'bufferMinutes')::integer
  );
  if (context_payload->>'requiresProfessionalAssignment')::boolean then
    assigned_professional := public.auto_assign_professional_for_booking(
      treatment_id, requested_starts_at, calculated_end, null
    );
    if assigned_professional is null then
      raise exception using errcode = '23P01', message = 'slot_not_available';
    end if;
  end if;

  select settings.timezone into booking_timezone
  from public.business_settings settings where settings.singleton;
  if not exists (
    select 1 from public.get_available_slots_for_booking_order_v2(
      payload,
      signature,
      (requested_starts_at at time zone booking_timezone)::date
    ) slot where slot.starts_at = requested_starts_at
  ) then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  end if;

  insert into public.customers(full_name, phone, email)
  values(trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), ''))
  returning id into new_customer_id;

  insert into public.bookings(
    idempotency_key,
    customer_id,
    treatment_id,
    specialty_id,
    professional_id,
    starts_at,
    ends_at,
    duration_snapshot_minutes,
    buffer_snapshot_minutes,
    base_price_snapshot_cents,
    applied_price_snapshot_cents,
    treatment_name_snapshot,
    customer_notes,
    treatment_option_combo_id,
    combo_name_snapshot,
    booking_order_v2_snapshot,
    package_charge_kind
  ) values (
    requested_idempotency_key,
    new_customer_id,
    treatment_id,
    (context_payload->>'specialtyId')::uuid,
    assigned_professional,
    requested_starts_at,
    calculated_end,
    (order_payload->>'durationMinutes')::integer,
    (context_payload->>'bufferMinutes')::integer,
    (order_payload->>'subtotalCents')::integer,
    (order_payload->>'totalCents')::integer,
    context_payload->>'treatmentName',
    nullif(trim(customer_notes), ''),
    combination_id,
    context_payload->'combination'->>'name',
    jsonb_build_object(
      'version', 1,
      'purpose', 'booking-order-v2',
      'selection', verified->'selection',
      'context', context_payload,
      'order', order_payload
    ),
    'standard'
  ) returning * into selected_booking;

  return query select selected_booking.id, selected_booking.booking_code, selected_booking.status;
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  when unique_violation then
    return query
    select booking.id, booking.booking_code, booking.status
    from public.bookings booking
    where booking.idempotency_key = requested_idempotency_key;
    if not found then raise; end if;
end;
$$;

revoke all on function public.get_booking_order_context_v2(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.get_available_slots_for_booking_order_v2(text, text, date) from public, anon, authenticated;
revoke all on function public.get_available_dates_for_booking_order_v2(text, text, date, date) from public, anon, authenticated;
revoke all on function public.create_booking_for_booking_order_v2(
  text, text, timestamptz, uuid, text, text, text, text, uuid, text, text
) from public, anon, authenticated;
revoke all on function private.verify_booking_order_quote_v2(text, text) from public, anon, authenticated;

grant execute on function public.get_booking_order_context_v2(uuid, uuid, uuid[]) to anon, authenticated;
grant execute on function public.get_available_slots_for_booking_order_v2(text, text, date) to anon, authenticated;
grant execute on function public.get_available_dates_for_booking_order_v2(text, text, date, date) to anon, authenticated;
grant execute on function public.create_booking_for_booking_order_v2(
  text, text, timestamptz, uuid, text, text, text, text, uuid, text, text
) to anon, authenticated;
