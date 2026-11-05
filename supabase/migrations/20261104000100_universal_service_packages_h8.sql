-- H8: neutral service-package contracts and transactional session management.
-- Additive only. The historical customer_packages/package_redemptions circuit
-- and every Depilation function remain untouched.

begin;

create function private.service_package_rules_valid(candidate jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
begin
  if jsonb_typeof(candidate) <> 'object' then return false; end if;
  if jsonb_typeof(candidate->'sessionsCount') <> 'number'
    or (candidate->>'sessionsCount')::integer not between 2 and 100 then return false; end if;
  if jsonb_typeof(candidate->'validityDays') <> 'number'
    or (candidate->>'validityDays')::integer not between 1 and 3650 then return false; end if;
  if coalesce(candidate->>'validityStartsFrom', '') not in ('purchase', 'first_session') then return false; end if;
  if candidate->'minDaysBetweenSessions' is null
    or not (
      candidate->'minDaysBetweenSessions' = 'null'::jsonb
      or (
        jsonb_typeof(candidate->'minDaysBetweenSessions') = 'number'
        and (candidate->>'minDaysBetweenSessions')::integer between 0 and 365
      )
    ) then return false; end if;
  if jsonb_typeof(candidate->'releaseNoticeHours') <> 'number'
    or (candidate->>'releaseNoticeHours')::integer not between 0 and 8760 then return false; end if;
  if jsonb_typeof(candidate->'maxReschedulesPerSession') <> 'number'
    or (candidate->>'maxReschedulesPerSession')::integer not between 0 and 50 then return false; end if;
  if jsonb_typeof(candidate->'absenceConsumesSession') <> 'boolean'
    or jsonb_typeof(candidate->'lateReleaseConsumesSession') <> 'boolean' then return false; end if;
  if candidate->'depositPercent' is null
    or not (
      candidate->'depositPercent' = 'null'::jsonb
      or (
        jsonb_typeof(candidate->'depositPercent') = 'number'
        and (candidate->>'depositPercent')::numeric between 0 and 100
      )
    ) then return false; end if;
  if candidate->'conditionsText' is null
    or not (
      candidate->'conditionsText' = 'null'::jsonb
      or (
        jsonb_typeof(candidate->'conditionsText') = 'string'
        and char_length(candidate->>'conditionsText') <= 2000
      )
    ) then return false; end if;
  return true;
exception when others then
  return false;
end;
$function$;

revoke all on function private.service_package_rules_valid(jsonb)
  from public, anon, authenticated;
grant execute on function private.service_package_rules_valid(jsonb)
  to authenticated;

alter table public.treatment_option_combos
  add column package_rules jsonb,
  add column package_rules_version smallint,
  add constraint treatment_option_combos_package_rules_version check (
    package_rules_version is null or package_rules_version = 1
  ),
  add constraint treatment_option_combos_package_rules_shape check (
    package_rules is null or private.service_package_rules_valid(package_rules)
  ),
  add constraint treatment_option_combos_package_rules_scope check (
    kind = 'package' or (package_rules is null and package_rules_version is null)
  ),
  add constraint treatment_option_combos_active_package_rules check (
    kind <> 'package' or not is_active
    or (package_rules is not null and package_rules_version = 1)
  );

comment on column public.treatment_option_combos.package_rules is
  'Per-offering service-package rules. Copied into the sold contract snapshot.';

alter table public.business_settings
  add column default_deposit_percent numeric(5,2),
  add constraint business_settings_default_deposit_percent check (
    default_deposit_percent is null
    or default_deposit_percent between 0 and 100
  );

create table public.service_package_contracts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  offering_id uuid not null references public.treatment_option_combos(id) on delete restrict,
  initial_booking_id uuid not null unique references public.bookings(id) on delete restrict,
  offering_name_snapshot text not null check (char_length(trim(offering_name_snapshot)) between 1 and 120),
  total_sessions integer not null check (total_sessions between 2 and 100),
  price_total_snapshot_cents integer not null check (price_total_snapshot_cents > 0),
  price_per_session_snapshot_cents integer not null check (price_per_session_snapshot_cents >= 0),
  duration_per_session_snapshot_minutes integer not null
    check (duration_per_session_snapshot_minutes between 5 and 480),
  buffer_snapshot_minutes integer not null default 0
    check (buffer_snapshot_minutes between 0 and 180),
  rules_snapshot jsonb not null,
  rules_version smallint not null default 1 check (rules_version = 1),
  validity_starts_from text not null check (validity_starts_from in ('purchase', 'first_session')),
  validity_starts_at timestamptz not null,
  validity_until timestamptz not null,
  payment_status text not null default 'deposit_pending'
    check (payment_status in ('deposit_pending', 'deposit_paid', 'paid_in_full')),
  deposit_paid_at timestamptz,
  paid_in_full_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'completed', 'expired', 'suspended')),
  status_reason text check (status_reason is null or char_length(trim(status_reason)) between 3 and 500),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_package_contracts_rules_valid
    check (private.service_package_rules_valid(rules_snapshot)),
  constraint service_package_contracts_rules_sessions_match
    check ((rules_snapshot->>'sessionsCount')::integer = total_sessions),
  constraint service_package_contracts_validity
    check (validity_starts_at < validity_until),
  constraint service_package_contracts_payment_dates check (
    (payment_status = 'deposit_pending' and deposit_paid_at is null and paid_in_full_at is null)
    or (payment_status = 'deposit_paid' and deposit_paid_at is not null and paid_in_full_at is null)
    or (payment_status = 'paid_in_full' and paid_in_full_at is not null)
  )
);

create index service_package_contracts_customer_idx
  on public.service_package_contracts(customer_id, created_at desc);
create index service_package_contracts_expiry_idx
  on public.service_package_contracts(validity_until)
  where status = 'active';

alter table public.bookings
  add column service_package_id uuid
    references public.service_package_contracts(id) on delete restrict;

create index bookings_service_package_idx
  on public.bookings(service_package_id, starts_at)
  where service_package_id is not null;

create table public.service_package_sessions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_package_contracts(id) on delete restrict,
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  session_number integer not null check (session_number between 1 and 10000),
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'released', 'lost')),
  suggested_outcome text check (suggested_outcome is null or suggested_outcome in ('completed', 'released', 'lost')),
  confirmed_outcome text check (confirmed_outcome is null or confirmed_outcome in ('completed', 'released', 'lost')),
  decision_is_exception boolean not null default false,
  decision_reason text check (decision_reason is null or char_length(trim(decision_reason)) between 3 and 500),
  decided_by uuid references public.profiles(user_id) on delete restrict,
  decided_at timestamptz,
  reschedule_count_snapshot integer not null default 0 check (reschedule_count_snapshot between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_package_sessions_number_unique unique (package_id, session_number),
  constraint service_package_sessions_decision_shape check (
    (status = 'reserved' and confirmed_outcome is null and decided_at is null and decided_by is null)
    or (
      status <> 'reserved'
      and confirmed_outcome = status
      and decided_at is not null
      and decided_by is not null
    )
  ),
  constraint service_package_sessions_exception_reason check (
    not decision_is_exception or decision_reason is not null
  )
);

create index service_package_sessions_package_idx
  on public.service_package_sessions(package_id, session_number);

create table public.service_package_operations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  package_id uuid not null references public.service_package_contracts(id) on delete restrict,
  session_id uuid references public.service_package_sessions(id) on delete restrict,
  operation text not null check (operation in ('register', 'reserve', 'reschedule', 'complete', 'release', 'lose', 'extend')),
  result jsonb not null,
  actor_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create index service_package_operations_package_idx
  on public.service_package_operations(package_id, created_at);

create trigger service_package_contracts_updated_at
  before update on public.service_package_contracts
  for each row execute function public.set_updated_at();
create trigger service_package_sessions_updated_at
  before update on public.service_package_sessions
  for each row execute function public.set_updated_at();
create trigger service_package_contracts_audit
  after insert or update or delete on public.service_package_contracts
  for each row execute function public.capture_admin_audit();
create trigger service_package_sessions_audit
  after insert or update or delete on public.service_package_sessions
  for each row execute function public.capture_admin_audit();

alter table public.service_package_contracts enable row level security;
alter table public.service_package_sessions enable row level security;
alter table public.service_package_operations enable row level security;

create policy service_package_contracts_operator_read
  on public.service_package_contracts for select to authenticated
  using (public.is_admin(auth.uid()));
create policy service_package_sessions_operator_read
  on public.service_package_sessions for select to authenticated
  using (public.is_admin(auth.uid()));
create policy service_package_operations_operator_read
  on public.service_package_operations for select to authenticated
  using (public.is_admin(auth.uid()));

revoke all on public.service_package_contracts from public, anon, authenticated;
revoke all on public.service_package_sessions from public, anon, authenticated;
revoke all on public.service_package_operations from public, anon, authenticated;
grant select on public.service_package_contracts to authenticated;
grant select on public.service_package_sessions to authenticated;
grant select on public.service_package_operations to authenticated;

create function private.service_package_balance(requested_package_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $function$
  select contract.total_sessions - count(session.id)::integer
  from public.service_package_contracts contract
  left join public.service_package_sessions session
    on session.package_id = contract.id
   and session.status in ('reserved', 'completed', 'lost')
  where contract.id = requested_package_id
  group by contract.total_sessions;
$function$;

revoke all on function private.service_package_balance(uuid)
  from public, anon, authenticated;

create function private.suggest_service_package_outcome(
  rules jsonb,
  appointment_starts_at timestamptz,
  event_name text,
  event_at timestamptz
)
returns text
language plpgsql
stable
set search_path = ''
as $function$
begin
  if not private.service_package_rules_valid(rules)
    or event_name not in ('attended', 'released', 'absence') then
    raise exception using errcode = '22023', message = 'package_outcome_input_invalid';
  end if;
  if event_name = 'attended' then return 'completed'; end if;
  if event_name = 'absence' then
    return case when (rules->>'absenceConsumesSession')::boolean then 'lost' else 'released' end;
  end if;
  if event_at > appointment_starts_at
      - make_interval(hours => (rules->>'releaseNoticeHours')::integer)
    and (rules->>'lateReleaseConsumesSession')::boolean then
    return 'lost';
  end if;
  return 'released';
end;
$function$;

revoke all on function private.suggest_service_package_outcome(jsonb,timestamptz,text,timestamptz)
  from public, anon, authenticated;

create function public.suggest_service_package_outcome(
  requested_package_id uuid,
  requested_booking_id uuid,
  requested_event text,
  requested_event_at timestamptz default now()
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  package_row public.service_package_contracts%rowtype;
  booking_row public.bookings%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select * into package_row from public.service_package_contracts where id = requested_package_id;
  select * into booking_row from public.bookings
    where id = requested_booking_id and service_package_id = requested_package_id;
  if package_row.id is null or booking_row.id is null then
    raise exception using errcode = 'P0002', message = 'package_session_not_found';
  end if;
  return private.suggest_service_package_outcome(
    package_row.rules_snapshot, booking_row.starts_at, requested_event, requested_event_at
  );
end;
$function$;

create function public.register_service_package_purchase(
  requested_booking_id uuid,
  requested_payment_status text,
  requested_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing_result jsonb;
  booking_row public.bookings%rowtype;
  treatment_row public.treatments%rowtype;
  offering_row public.treatment_option_combos%rowtype;
  rules jsonb;
  configured_deposit numeric;
  validity_start timestamptz;
  contract_row public.service_package_contracts%rowtype;
  session_row public.service_package_sessions%rowtype;
  result_payload jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if requested_idempotency_key is null
    or requested_payment_status not in ('deposit_pending', 'deposit_paid', 'paid_in_full') then
    raise exception using errcode = '22023', message = 'package_purchase_input_invalid';
  end if;

  select operation.result into existing_result
  from public.service_package_operations operation
  where operation.idempotency_key = requested_idempotency_key
    and operation.operation = 'register';
  if existing_result is not null then return existing_result; end if;

  select * into booking_row from public.bookings
  where id = requested_booking_id for update;
  if booking_row.id is null or booking_row.status not in ('pending', 'awaiting_deposit', 'confirmed')
    or booking_row.treatment_option_combo_id is null then
    raise exception using errcode = '22023', message = 'package_initial_booking_invalid';
  end if;

  select * into treatment_row from public.treatments
  where id = booking_row.treatment_id and config_enabled and booking_config->>'mode' = 'package';
  select * into offering_row from public.treatment_option_combos
  where id = booking_row.treatment_option_combo_id
    and treatment_id = booking_row.treatment_id
    and kind = 'package';
  if treatment_row.id is null or offering_row.id is null then
    raise exception using errcode = '22023', message = 'package_offering_invalid';
  end if;

  rules := coalesce(offering_row.package_rules, treatment_row.booking_config->'packageDefaults');
  if not private.service_package_rules_valid(rules)
    or (rules->>'sessionsCount')::integer <> offering_row.session_count then
    raise exception using errcode = '22023', message = 'package_rules_invalid';
  end if;
  if rules->'depositPercent' = 'null'::jsonb then
    select default_deposit_percent into configured_deposit
    from public.business_settings where singleton;
    rules := jsonb_set(rules, '{depositPercent}', coalesce(to_jsonb(configured_deposit), 'null'::jsonb));
  end if;

  validity_start := case rules->>'validityStartsFrom'
    when 'first_session' then booking_row.starts_at else now() end;

  insert into public.service_package_contracts(
    idempotency_key, customer_id, treatment_id, offering_id, initial_booking_id,
    offering_name_snapshot, total_sessions, price_total_snapshot_cents,
    price_per_session_snapshot_cents, duration_per_session_snapshot_minutes,
    buffer_snapshot_minutes, rules_snapshot, rules_version,
    validity_starts_from, validity_starts_at, validity_until,
    payment_status, deposit_paid_at, paid_in_full_at, created_by
  ) values (
    requested_idempotency_key, booking_row.customer_id, booking_row.treatment_id,
    offering_row.id, booking_row.id, offering_row.name, offering_row.session_count,
    offering_row.price_cents,
    round(offering_row.price_cents::numeric / offering_row.session_count)::integer,
    offering_row.duration_minutes, booking_row.buffer_snapshot_minutes, rules, 1,
    rules->>'validityStartsFrom', validity_start,
    validity_start + make_interval(days => (rules->>'validityDays')::integer),
    requested_payment_status,
    case when requested_payment_status = 'deposit_paid' then now() end,
    case when requested_payment_status = 'paid_in_full' then now() end,
    auth.uid()
  ) returning * into contract_row;

  update public.bookings set service_package_id = contract_row.id
  where id = booking_row.id;

  insert into public.service_package_sessions(
    package_id, booking_id, session_number, status, reschedule_count_snapshot
  ) values (
    contract_row.id, booking_row.id, 1, 'reserved', booking_row.reschedule_count
  ) returning * into session_row;

  result_payload := jsonb_build_object(
    'packageId', contract_row.id,
    'sessionId', session_row.id,
    'bookingId', booking_row.id,
    'status', contract_row.status,
    'paymentStatus', contract_row.payment_status,
    'balance', private.service_package_balance(contract_row.id)
  );
  insert into public.service_package_operations(
    idempotency_key, package_id, session_id, operation, result, actor_id
  ) values (
    requested_idempotency_key, contract_row.id, session_row.id, 'register', result_payload, auth.uid()
  );
  return result_payload;
exception when unique_violation then
  select operation.result into existing_result
  from public.service_package_operations operation
  where operation.idempotency_key = requested_idempotency_key
    and operation.operation = 'register';
  if existing_result is not null then return existing_result; end if;
  raise;
end;
$function$;

create function public.get_available_slots_for_service_package(
  requested_package_id uuid,
  requested_date date,
  excluded_booking_id uuid default null
)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  package_row public.service_package_contracts%rowtype;
  initial_booking public.bookings%rowtype;
  treatment_row public.treatments%rowtype;
  minimum_days integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select * into package_row from public.service_package_contracts
  where id = requested_package_id and status = 'active' and validity_until > now();
  if package_row.id is null then
    raise exception using errcode = 'P0002', message = 'package_not_available';
  end if;
  select * into initial_booking from public.bookings where id = package_row.initial_booking_id;
  select * into treatment_row from public.treatments where id = package_row.treatment_id;
  if initial_booking.specialty_id is distinct from treatment_row.specialty_id then
    raise exception using errcode = '22023', message = 'package_specialty_changed';
  end if;
  minimum_days := coalesce((package_row.rules_snapshot->>'minDaysBetweenSessions')::integer, 0);

  return query
  select candidate.starts_at, candidate.ends_at
  from private.get_snapshot_slots(
    package_row.treatment_id,
    initial_booking.specialty_id,
    requested_date,
    package_row.duration_per_session_snapshot_minutes + package_row.buffer_snapshot_minutes,
    treatment_row.start_interval_minutes,
    null,
    excluded_booking_id,
    package_row.validity_until
  ) candidate
  where not exists (
    select 1
    from public.service_package_sessions session
    join public.bookings booking on booking.id = session.booking_id
    where session.package_id = package_row.id
      and session.status <> 'released'
      and booking.id is distinct from excluded_booking_id
      and abs(extract(epoch from (candidate.starts_at - booking.starts_at)))
        < minimum_days * 86400
  );
end;
$function$;

create function public.manage_service_package_session(
  requested_package_id uuid,
  requested_action text,
  requested_idempotency_key uuid,
  requested_booking_id uuid default null,
  requested_starts_at timestamptz default null,
  requested_event_at timestamptz default now(),
  requested_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing_operation public.service_package_operations%rowtype;
  package_row public.service_package_contracts%rowtype;
  session_row public.service_package_sessions%rowtype;
  booking_row public.bookings%rowtype;
  initial_booking public.bookings%rowtype;
  assigned_professional uuid;
  computed_ends_at timestamptz;
  booking_timezone text;
  session_number integer;
  suggested text;
  confirmed text;
  is_exception boolean := false;
  balance integer;
  result_payload jsonb;
  consumed_count integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if requested_idempotency_key is null
    or requested_action not in ('reserve', 'reschedule', 'complete', 'release', 'lose') then
    raise exception using errcode = '22023', message = 'package_session_input_invalid';
  end if;

  select * into existing_operation from public.service_package_operations
  where idempotency_key = requested_idempotency_key;
  if existing_operation.id is not null then
    if existing_operation.package_id <> requested_package_id
      or existing_operation.operation <> requested_action then
      raise exception using errcode = '22023', message = 'idempotency_key_conflict';
    end if;
    return existing_operation.result;
  end if;

  select * into package_row from public.service_package_contracts
  where id = requested_package_id for update;
  if package_row.id is null then
    raise exception using errcode = 'P0002', message = 'package_not_found';
  end if;
  if package_row.status <> 'active' or package_row.validity_until <= now() then
    raise exception using errcode = '22023', message = 'package_not_available';
  end if;

  select * into initial_booking from public.bookings where id = package_row.initial_booking_id;

  if requested_action = 'reserve' then
    if requested_booking_id is not null or requested_starts_at is null then
      raise exception using errcode = '22023', message = 'package_reservation_input_invalid';
    end if;
    balance := private.service_package_balance(package_row.id);
    if balance <= 0 then
      raise exception using errcode = '22023', message = 'package_has_no_sessions';
    end if;
    select timezone into booking_timezone from public.business_settings where singleton;
    select slot.ends_at into computed_ends_at
    from public.get_available_slots_for_service_package(
      package_row.id,
      (requested_starts_at at time zone booking_timezone)::date,
      null
    ) slot where slot.starts_at = requested_starts_at;
    if computed_ends_at is null then
      raise exception using errcode = '23P01', message = 'slot_not_available';
    end if;
    assigned_professional := private.find_booking_professional(
      package_row.treatment_id, requested_starts_at, computed_ends_at, null, null
    );
    if assigned_professional is null then
      raise exception using errcode = '23P01', message = 'slot_not_available';
    end if;

    insert into public.bookings(
      idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
      starts_at, ends_at, duration_snapshot_minutes, buffer_snapshot_minutes,
      base_price_snapshot_cents, applied_price_snapshot_cents,
      treatment_name_snapshot, treatment_option_combo_id, combo_name_snapshot,
      booking_order_v2_snapshot, package_charge_kind, service_package_id,
      status, confirmed_at, deposit_confirmed_at, status_changed_at, status_changed_by
    ) values (
      requested_idempotency_key, package_row.customer_id, package_row.treatment_id,
      initial_booking.specialty_id, assigned_professional, requested_starts_at,
      computed_ends_at, package_row.duration_per_session_snapshot_minutes,
      package_row.buffer_snapshot_minutes, package_row.price_total_snapshot_cents,
      0, initial_booking.treatment_name_snapshot, package_row.offering_id,
      package_row.offering_name_snapshot, initial_booking.booking_order_v2_snapshot,
      'package_included', package_row.id, 'confirmed', now(), now(), now(), auth.uid()
    ) returning * into booking_row;

    select coalesce(max(session.session_number), 0) + 1 into session_number
    from public.service_package_sessions session where session.package_id = package_row.id;
    insert into public.service_package_sessions(
      package_id, booking_id, session_number, status, reschedule_count_snapshot
    ) values (
      package_row.id, booking_row.id, session_number, 'reserved', booking_row.reschedule_count
    ) returning * into session_row;
  else
    select session.* into session_row
    from public.service_package_sessions session
    where session.package_id = package_row.id and session.booking_id = requested_booking_id
    for update;
    if session_row.id is null then
      raise exception using errcode = 'P0002', message = 'package_session_not_found';
    end if;
    select * into booking_row from public.bookings where id = session_row.booking_id for update;

    if requested_action = 'reschedule' then
      if session_row.status <> 'reserved' or requested_starts_at is null then
        raise exception using errcode = '22023', message = 'package_session_cannot_be_rescheduled';
      end if;
      if booking_row.reschedule_count >= (package_row.rules_snapshot->>'maxReschedulesPerSession')::integer then
        raise exception using errcode = '22023', message = 'package_reschedule_limit_reached';
      end if;
      select timezone into booking_timezone from public.business_settings where singleton;
      select slot.ends_at into computed_ends_at
      from public.get_available_slots_for_service_package(
        package_row.id,
        (requested_starts_at at time zone booking_timezone)::date,
        booking_row.id
      ) slot where slot.starts_at = requested_starts_at;
      if computed_ends_at is null then
        raise exception using errcode = '23P01', message = 'slot_not_available';
      end if;
      assigned_professional := private.find_booking_professional(
        package_row.treatment_id, requested_starts_at, computed_ends_at,
        booking_row.professional_id, booking_row.id
      );
      if assigned_professional is null then
        assigned_professional := private.find_booking_professional(
          package_row.treatment_id, requested_starts_at, computed_ends_at, null, booking_row.id
        );
      end if;
      if assigned_professional is null then
        raise exception using errcode = '23P01', message = 'slot_not_available';
      end if;

      update public.bookings set
        starts_at = requested_starts_at,
        ends_at = computed_ends_at,
        professional_id = assigned_professional,
        rescheduled_at = now(),
        reschedule_count = reschedule_count + 1
      where id = booking_row.id returning * into booking_row;
      update public.service_package_sessions set
        reschedule_count_snapshot = booking_row.reschedule_count
      where id = session_row.id returning * into session_row;

      if booking_row.id = package_row.initial_booking_id
        and package_row.validity_starts_from = 'first_session'
        and not exists (
          select 1 from public.service_package_sessions consumed
          where consumed.package_id = package_row.id
            and consumed.status in ('completed', 'lost')
        ) then
        update public.service_package_contracts set
          validity_starts_at = requested_starts_at,
          validity_until = requested_starts_at
            + make_interval(days => (rules_snapshot->>'validityDays')::integer)
        where id = package_row.id returning * into package_row;
      end if;
    else
      if session_row.status <> 'reserved' then
        raise exception using errcode = '22023', message = 'package_session_already_closed';
      end if;
      suggested := private.suggest_service_package_outcome(
        package_row.rules_snapshot,
        booking_row.starts_at,
        case requested_action
          when 'complete' then 'attended'
          when 'release' then 'released'
          else 'absence'
        end,
        requested_event_at
      );
      confirmed := case requested_action
        when 'complete' then 'completed'
        when 'release' then 'released'
        else 'lost'
      end;
      is_exception := confirmed <> suggested;
      if is_exception and nullif(trim(requested_reason), '') is null then
        raise exception using errcode = '22023', message = 'package_exception_reason_required';
      end if;

      update public.service_package_sessions set
        status = confirmed,
        suggested_outcome = suggested,
        confirmed_outcome = confirmed,
        decision_is_exception = is_exception,
        decision_reason = nullif(trim(requested_reason), ''),
        decided_by = auth.uid(),
        decided_at = requested_event_at,
        reschedule_count_snapshot = booking_row.reschedule_count
      where id = session_row.id returning * into session_row;

      update public.bookings set
        status = case confirmed
          when 'completed' then 'completed'::public.booking_status
          when 'released' then 'cancelled'::public.booking_status
          else 'no_show'::public.booking_status
        end,
        completed_at = case when confirmed = 'completed' then requested_event_at end,
        cancelled_at = case when confirmed = 'released' then requested_event_at end,
        no_show_at = case when confirmed = 'lost' then requested_event_at end,
        status_reason = coalesce(nullif(trim(requested_reason), ''), 'Cierre de sesión de paquete'),
        status_changed_at = requested_event_at,
        status_changed_by = auth.uid()
      where id = booking_row.id returning * into booking_row;

      insert into public.booking_status_history(
        booking_id, previous_status, next_status, reason, actor_id
      ) values (
        booking_row.id, 'confirmed', booking_row.status,
        coalesce(nullif(trim(requested_reason), ''), 'Cierre de sesión de paquete'), auth.uid()
      );

      if is_exception then
        insert into public.audit_log(
          actor_id, table_name, record_id, action, old_data, new_data
        ) values (
          auth.uid(), 'service_package_sessions', session_row.id, 'update',
          null,
          jsonb_build_object(
            'event', 'package_outcome_exception',
            'suggested', suggested,
            'confirmed', confirmed,
            'reason', trim(requested_reason)
          )
        );
      end if;
    end if;
  end if;

  balance := private.service_package_balance(package_row.id);
  if balance < 0 then
    raise exception using errcode = '23514', message = 'package_balance_negative';
  end if;
  select count(*)::integer into consumed_count
  from public.service_package_sessions session
  where session.package_id = package_row.id and session.status in ('completed', 'lost');
  if consumed_count >= package_row.total_sessions then
    update public.service_package_contracts
      set status = 'completed', status_reason = 'Todas las sesiones fueron utilizadas'
    where id = package_row.id;
  end if;

  result_payload := jsonb_build_object(
    'packageId', package_row.id,
    'sessionId', session_row.id,
    'bookingId', session_row.booking_id,
    'action', requested_action,
    'sessionStatus', session_row.status,
    'suggestedOutcome', session_row.suggested_outcome,
    'isException', session_row.decision_is_exception,
    'balance', balance
  );
  insert into public.service_package_operations(
    idempotency_key, package_id, session_id, operation, result, actor_id
  ) values (
    requested_idempotency_key, package_row.id, session_row.id,
    requested_action, result_payload, auth.uid()
  );
  return result_payload;
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'slot_not_available';
end;
$function$;

create function public.extend_service_package_validity(
  requested_package_id uuid,
  requested_additional_days integer,
  requested_reason text,
  requested_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing_operation public.service_package_operations%rowtype;
  package_row public.service_package_contracts%rowtype;
  result_payload jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if requested_additional_days not between 1 and 730
    or char_length(trim(coalesce(requested_reason, ''))) not between 3 and 500
    or requested_idempotency_key is null then
    raise exception using errcode = '22023', message = 'package_extension_input_invalid';
  end if;
  select * into existing_operation from public.service_package_operations
  where idempotency_key = requested_idempotency_key;
  if existing_operation.id is not null then
    if existing_operation.package_id <> requested_package_id
      or existing_operation.operation <> 'extend' then
      raise exception using errcode = '22023', message = 'idempotency_key_conflict';
    end if;
    return existing_operation.result;
  end if;
  select * into package_row from public.service_package_contracts
  where id = requested_package_id for update;
  if package_row.id is null or package_row.status not in ('active', 'expired') then
    raise exception using errcode = 'P0002', message = 'package_not_extendable';
  end if;
  update public.service_package_contracts set
    validity_until = validity_until + make_interval(days => requested_additional_days),
    status = 'active',
    status_reason = trim(requested_reason)
  where id = requested_package_id returning * into package_row;
  result_payload := jsonb_build_object(
    'packageId', package_row.id,
    'validityUntil', package_row.validity_until,
    'status', package_row.status
  );
  insert into public.service_package_operations(
    idempotency_key, package_id, operation, result, actor_id
  ) values (
    requested_idempotency_key, package_row.id, 'extend', result_payload, auth.uid()
  );
  return result_payload;
end;
$function$;

revoke all on function public.suggest_service_package_outcome(uuid,uuid,text,timestamptz)
  from public, anon, authenticated;
revoke all on function public.register_service_package_purchase(uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.get_available_slots_for_service_package(uuid,date,uuid)
  from public, anon, authenticated;
revoke all on function public.manage_service_package_session(uuid,text,uuid,uuid,timestamptz,timestamptz,text)
  from public, anon, authenticated;
revoke all on function public.extend_service_package_validity(uuid,integer,text,uuid)
  from public, anon, authenticated;

grant execute on function public.suggest_service_package_outcome(uuid,uuid,text,timestamptz)
  to authenticated;
grant execute on function public.register_service_package_purchase(uuid,text,uuid)
  to authenticated;
grant execute on function public.get_available_slots_for_service_package(uuid,date,uuid)
  to authenticated;
grant execute on function public.manage_service_package_session(uuid,text,uuid,uuid,timestamptz,timestamptz,text)
  to authenticated;
grant execute on function public.extend_service_package_validity(uuid,integer,text,uuid)
  to authenticated;

commit;
