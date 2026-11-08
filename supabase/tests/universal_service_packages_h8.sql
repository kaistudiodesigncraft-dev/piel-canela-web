\set ON_ERROR_STOP on
\echo 1..1
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('88000000-0000-4000-8000-000000000098','authenticated','authenticated','h8-admin@example.invalid','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('88000000-0000-4000-8000-000000000098','H8 admin local','admin',true);
insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('88000000-0000-4000-8000-000000000090','H8 QA','h8-qa','Categoría aislada H8.','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('88000000-0000-4000-8000-000000000091','H8 QA','h8-qa',true);
insert into public.professionals(id,specialty_id,full_name,is_active)
values('88000000-0000-4000-8000-000000000092','88000000-0000-4000-8000-000000000091','Profesional H8 QA',true);
insert into public.professional_specialties(professional_id,specialty_id)
values('88000000-0000-4000-8000-000000000092','88000000-0000-4000-8000-000000000091');
insert into public.treatments(
  id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,start_interval_minutes,price_cents,selection_mode,
  requires_professional_assignment,is_active,config_enabled,booking_config
) values (
  'e6926fc8-f910-4b26-8c4b-53a9d27be7b7',
  '88000000-0000-4000-8000-000000000090','88000000-0000-4000-8000-000000000091',
  '88000000-0000-4000-8000-000000000092','H8 paquete QA','h8-paquete-qa',
  'Paquete aislado para pruebas H8','Tratamiento local usado para validar paquetes universales H8.',
  30,0,30,120000,'simple',true,false,false,null
);
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values('e6926fc8-f910-4b26-8c4b-53a9d27be7b7','88000000-0000-4000-8000-000000000092',true);

do $test$
declare
  admin_id uuid;
  fixture_treatment_id constant uuid := 'e6926fc8-f910-4b26-8c4b-53a9d27be7b7';
  offering_id constant uuid := '88000000-0000-4000-8000-000000000001';
  customer_id constant uuid := '88000000-0000-4000-8000-000000000002';
  initial_booking_id constant uuid := '88000000-0000-4000-8000-000000000003';
  professional_id uuid;
  specialty_id uuid;
  test_day date := current_date + 10;
  second_day date := current_date + 15;
  rules jsonb := jsonb_build_object(
    'sessionsCount', 2,
    'validityDays', 60,
    'validityStartsFrom', 'first_session',
    'minDaysBetweenSessions', 2,
    'releaseNoticeHours', 48,
    'maxReschedulesPerSession', 1,
    'absenceConsumesSession', true,
    'lateReleaseConsumesSession', true,
    'depositPercent', null,
    'conditionsText', null
  );
begin
  select profile.user_id into admin_id
  from public.profiles profile
  join auth.users account on account.id = profile.user_id
  where profile.role in ('admin', 'manager') and profile.is_active
  order by profile.created_at limit 1;
  select treatment.specialty_id into specialty_id
  from public.treatments treatment where treatment.id = fixture_treatment_id;
  select link.professional_id into professional_id
  from public.treatment_professionals link
  join public.professionals professional on professional.id = link.professional_id and professional.is_active
  where link.treatment_id = fixture_treatment_id and link.is_active
  order by link.display_order, link.professional_id limit 1;
  if admin_id is null or specialty_id is null or professional_id is null then
    raise exception 'h8_fixture_prerequisite_missing';
  end if;

  -- H4 intentionally blocks package activation until H9. The test bypasses
  -- only that legacy trigger while creating an isolated local fixture.
  execute 'alter table public.treatments disable trigger treatments_enforce_configured_readiness';
  update public.treatments set
    config_enabled = true,
    is_active = true,
    booking_config = jsonb_build_object(
      'version', 1,
      'mode', 'package',
      'optionsLabel', jsonb_build_object('singular', 'paquete', 'plural', 'paquetes'),
      'selectionMode', 'single',
      'minSelections', 0,
      'maxSelections', 0,
      'allowLooseOptions', false,
      'allowCombos', true,
      'allowAddons', false,
      'priceRule', jsonb_build_object('type', 'package_price'),
      'durationRule', jsonb_build_object('type', 'per_session', 'durationMinutes', 30),
      'packageDefaults', rules,
      'conditionsText', null
    )
  where id = fixture_treatment_id;
  execute 'alter table public.treatments enable trigger treatments_enforce_configured_readiness';

  insert into public.treatment_option_combos(
    id, treatment_id, name, description, kind, price_cents,
    duration_minutes, session_count, display_order, is_active,
    package_rules, package_rules_version
  ) values (
    offering_id, fixture_treatment_id, 'Paquete H8 QA', '', 'package', 120000,
    30, 2, 9999, true, rules, 1
  );
  insert into public.customers(id, full_name, phone, email)
  values(customer_id, 'Cliente QA H8', '3510000000', null);

  insert into public.availability_exceptions(
    specialty_id, kind, starts_at, ends_at, internal_reason, created_by
  ) values
    (specialty_id, 'open', (test_day + time '09:00') at time zone 'America/Argentina/Cordoba',
      (test_day + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local', admin_id),
    (specialty_id, 'open', (second_day + time '09:00') at time zone 'America/Argentina/Cordoba',
      (second_day + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local', admin_id),
    (specialty_id, 'open', ((second_day + 1) + time '09:00') at time zone 'America/Argentina/Cordoba',
      ((second_day + 1) + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local', admin_id),
    (specialty_id, 'open', ((second_day + 3) + time '09:00') at time zone 'America/Argentina/Cordoba',
      ((second_day + 3) + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local', admin_id),
    (specialty_id, 'open', ((second_day + 4) + time '09:00') at time zone 'America/Argentina/Cordoba',
      ((second_day + 4) + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local', admin_id);
  insert into public.professional_availability_exceptions(
    professional_id, kind, starts_at, ends_at, reason
  ) values
    (professional_id, 'open', (test_day + time '09:00') at time zone 'America/Argentina/Cordoba',
      (test_day + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local'),
    (professional_id, 'open', (second_day + time '09:00') at time zone 'America/Argentina/Cordoba',
      (second_day + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local'),
    (professional_id, 'open', ((second_day + 1) + time '09:00') at time zone 'America/Argentina/Cordoba',
      ((second_day + 1) + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local'),
    (professional_id, 'open', ((second_day + 3) + time '09:00') at time zone 'America/Argentina/Cordoba',
      ((second_day + 3) + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local'),
    (professional_id, 'open', ((second_day + 4) + time '09:00') at time zone 'America/Argentina/Cordoba',
      ((second_day + 4) + time '18:00') at time zone 'America/Argentina/Cordoba', 'H8 local');

  insert into public.bookings(
    id, idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    starts_at, ends_at, duration_snapshot_minutes, buffer_snapshot_minutes,
    base_price_snapshot_cents, applied_price_snapshot_cents, treatment_name_snapshot,
    status, treatment_option_combo_id, combo_name_snapshot,
    booking_order_v2_snapshot, package_charge_kind
  ) values (
    initial_booking_id, '88000000-0000-4000-8000-000000000004', customer_id,
    fixture_treatment_id, specialty_id, professional_id,
    (test_day + time '10:00') at time zone 'America/Argentina/Cordoba',
    (test_day + time '10:30') at time zone 'America/Argentina/Cordoba',
    30, 0, 120000, 120000, 'H6 Simple QA', 'confirmed', offering_id,
    'Paquete H8 QA', '{"version":1,"purpose":"booking-order-v2"}'::jsonb, 'standard'
  );
  perform set_config('h8.admin_id', admin_id::text, true);
  perform set_config('h8.test_day', test_day::text, true);
  perform set_config('h8.second_day', second_day::text, true);
end;
$test$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('h8.admin_id'), true);

do $test$
declare
  first_result jsonb;
  replay_result jsonb;
  contract_id uuid;
  rules_before jsonb;
  rules_after jsonb;
begin
  first_result := public.register_service_package_purchase(
    '88000000-0000-4000-8000-000000000003',
    'deposit_paid',
    '88000000-0000-4000-8000-000000000005'
  );
  replay_result := public.register_service_package_purchase(
    '88000000-0000-4000-8000-000000000003',
    'deposit_paid',
    '88000000-0000-4000-8000-000000000005'
  );
  if first_result is distinct from replay_result then raise exception 'register_not_idempotent'; end if;
  if (first_result->>'balance')::integer <> 1 then raise exception 'initial_balance_invalid'; end if;
  contract_id := (first_result->>'packageId')::uuid;
  select rules_snapshot into rules_before from public.service_package_contracts where id = contract_id;

  update public.treatment_option_combos set package_rules = jsonb_set(package_rules, '{validityDays}', '90')
  where id = '88000000-0000-4000-8000-000000000001';
  select rules_snapshot into rules_after from public.service_package_contracts where id = contract_id;
  if rules_before is distinct from rules_after then raise exception 'rules_snapshot_mutated'; end if;
end;
$test$;

do $test$
declare
  contract_id uuid;
  initial_start timestamptz;
  failed_as_expected boolean := false;
  close_result jsonb;
begin
  select id into contract_id from public.service_package_contracts
  where initial_booking_id = '88000000-0000-4000-8000-000000000003';
  select starts_at into initial_start from public.bookings
  where id = '88000000-0000-4000-8000-000000000003';
  begin
    perform public.manage_service_package_session(
      contract_id, 'release', '88000000-0000-4000-8000-000000000006',
      '88000000-0000-4000-8000-000000000003', null,
      initial_start - interval '1 hour', null
    );
  exception when sqlstate '22023' then
    failed_as_expected := sqlerrm = 'package_exception_reason_required';
  end;
  if not failed_as_expected then raise exception 'exception_reason_not_enforced'; end if;

  close_result := public.manage_service_package_session(
    contract_id, 'release', '88000000-0000-4000-8000-000000000007',
    '88000000-0000-4000-8000-000000000003', null,
    initial_start - interval '1 hour', 'Recepción confirma liberación excepcional'
  );
  if close_result->>'sessionStatus' <> 'released'
    or (close_result->>'balance')::integer <> 2
    or (close_result->>'isException')::boolean is not true then
    raise exception 'release_exception_result_invalid';
  end if;
  perform set_config('h8.exception_session_id', close_result->>'sessionId', true);
end;
$test$;

reset role;
do $test$
begin
  if not exists (
    select 1 from public.audit_log
    where table_name = 'service_package_sessions'
      and record_id = current_setting('h8.exception_session_id')::uuid
      and new_data->>'event' = 'package_outcome_exception'
  ) then raise exception 'exception_audit_missing'; end if;
end;
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('h8.admin_id'), true);

do $test$
declare
  contract_id uuid;
  second_day date := current_setting('h8.second_day')::date;
  slot_start timestamptz;
  reserve_result jsonb;
  replay_result jsonb;
  complete_result jsonb;
  final_reserve jsonb;
  first_reschedule jsonb;
  next_slot timestamptz;
  moved_slot timestamptz;
  failed_as_expected boolean := false;
begin
  select id into contract_id from public.service_package_contracts
  where initial_booking_id = '88000000-0000-4000-8000-000000000003';
  select min(starts_at) into slot_start
  from public.get_available_slots_for_service_package(contract_id, second_day, null);
  if slot_start is null then raise exception 'package_slot_missing'; end if;

  reserve_result := public.manage_service_package_session(
    contract_id, 'reserve', '88000000-0000-4000-8000-000000000008',
    null, slot_start, now(), null
  );
  replay_result := public.manage_service_package_session(
    contract_id, 'reserve', '88000000-0000-4000-8000-000000000008',
    null, slot_start, now(), null
  );
  if reserve_result is distinct from replay_result then raise exception 'reserve_not_idempotent'; end if;
  if (reserve_result->>'balance')::integer <> 1 then raise exception 'reserve_balance_invalid'; end if;

  complete_result := public.manage_service_package_session(
    contract_id, 'complete', '88000000-0000-4000-8000-000000000009',
    (reserve_result->>'bookingId')::uuid, null, slot_start + interval '30 minutes', null
  );
  if complete_result->>'sessionStatus' <> 'completed'
    or (complete_result->>'balance')::integer <> 1 then
    raise exception 'complete_result_invalid';
  end if;

  select min(starts_at) into next_slot
  from public.get_available_slots_for_service_package(contract_id, second_day + 3, null);
  final_reserve := public.manage_service_package_session(
    contract_id, 'reserve', '88000000-0000-4000-8000-000000000011',
    null, next_slot, now(), null
  );
  select min(starts_at) into moved_slot
  from public.get_available_slots_for_service_package(
    contract_id, second_day + 4, (final_reserve->>'bookingId')::uuid
  );
  first_reschedule := public.manage_service_package_session(
    contract_id, 'reschedule', '88000000-0000-4000-8000-000000000012',
    (final_reserve->>'bookingId')::uuid, moved_slot, now(), null
  );
  if first_reschedule->>'action' <> 'reschedule' then raise exception 'reschedule_failed'; end if;
  begin
    perform public.manage_service_package_session(
      contract_id, 'reschedule', '88000000-0000-4000-8000-000000000013',
      (final_reserve->>'bookingId')::uuid, moved_slot, now(), null
    );
  exception when sqlstate '22023' then
    failed_as_expected := sqlerrm = 'package_reschedule_limit_reached';
  end;
  if not failed_as_expected then raise exception 'reschedule_limit_not_enforced'; end if;
  perform set_config('h8.contract_id', contract_id::text, true);
end;
$test$;

reset role;
update public.service_package_contracts set
  status='expired', validity_starts_at=now()-interval '2 days', validity_until=now()-interval '1 day'
where id=current_setting('h8.contract_id')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('h8.admin_id'), true);
do $test$
declare
  failed_as_expected boolean := false;
  extension_result jsonb;
  replay_result jsonb;
begin
  begin
    perform public.manage_service_package_session(
      current_setting('h8.contract_id')::uuid,'reserve',
      '88000000-0000-4000-8000-000000000014',null,
      now()+interval '2 days',now(),null
    );
  exception when sqlstate '22023' then
    failed_as_expected := sqlerrm='package_not_available';
  end;
  if not failed_as_expected then raise exception 'expired_package_accepted_session'; end if;
  extension_result := public.extend_service_package_validity(
    current_setting('h8.contract_id')::uuid,10,'Extensión QA autorizada',
    '88000000-0000-4000-8000-000000000015'
  );
  replay_result := public.extend_service_package_validity(
    current_setting('h8.contract_id')::uuid,10,'Extensión QA autorizada',
    '88000000-0000-4000-8000-000000000015'
  );
  if extension_result is distinct from replay_result
    or extension_result->>'status' <> 'active'
    or (extension_result->>'validityUntil')::timestamptz <= now() then
    raise exception 'package_extension_invalid';
  end if;
end;
$test$;

-- RLS and grants: anon cannot read; an authenticated non-operator sees no rows
-- and cannot call an operator RPC or write directly.
reset role;
do $test$
declare
  table_name text;
begin
  foreach table_name in array array[
    'service_package_contracts',
    'service_package_sessions',
    'service_package_operations'
  ] loop
    if has_table_privilege('anon', 'public.' || table_name, 'select')
      or has_table_privilege('anon', 'public.' || table_name, 'insert')
      or has_table_privilege('anon', 'public.' || table_name, 'update')
      or has_table_privilege('anon', 'public.' || table_name, 'delete') then
      raise exception 'anon_table_privilege_leak:%', table_name;
    end if;
    if not has_table_privilege('authenticated', 'public.' || table_name, 'select')
      or has_table_privilege('authenticated', 'public.' || table_name, 'insert')
      or has_table_privilege('authenticated', 'public.' || table_name, 'update')
      or has_table_privilege('authenticated', 'public.' || table_name, 'delete') then
      raise exception 'authenticated_table_privilege_mismatch:%', table_name;
    end if;
  end loop;
end;
$test$;

set local role anon;
do $test$
begin
  begin perform count(*) from public.service_package_contracts;
    raise exception 'anon_read_should_fail';
  exception when insufficient_privilege then null; end;
end;
$test$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '88000000-0000-4000-8000-000000000099', true);
do $test$
begin
  if (select count(*) from public.service_package_contracts) <> 0 then
    raise exception 'non_operator_read_leak';
  end if;
  if (select count(*) from public.service_package_sessions) <> 0
    or (select count(*) from public.service_package_operations) <> 0 then
    raise exception 'non_operator_related_table_read_leak';
  end if;
  begin
    perform public.extend_service_package_validity(
      (select id from public.service_package_contracts limit 1), 1, 'No permitido',
      '88000000-0000-4000-8000-000000000010'
    );
    raise exception 'non_operator_rpc_should_fail';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.service_package_sessions(package_id,booking_id,session_number)
    values(gen_random_uuid(),gen_random_uuid(),99);
    raise exception 'direct_write_should_fail';
  exception when insufficient_privilege then null; end;
end;
$test$;

rollback;
\echo ok 1 - universal service package H8 assertions passed
