\set ON_ERROR_STOP on
\echo 1..1
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('89000000-0000-4000-8000-000000000098','authenticated','authenticated','h9-admin@example.invalid','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('89000000-0000-4000-8000-000000000098','H9 admin local','admin',true);
insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('89000000-0000-4000-8000-000000000090','H9 QA','h9-qa','Categoría aislada H9.','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('89000000-0000-4000-8000-000000000091','H9 QA','h9-qa',true);
insert into public.professionals(id,specialty_id,full_name,is_active)
values('89000000-0000-4000-8000-000000000092','89000000-0000-4000-8000-000000000091','Profesional H9 QA',true);
insert into public.professional_specialties(professional_id,specialty_id)
values('89000000-0000-4000-8000-000000000092','89000000-0000-4000-8000-000000000091');
insert into public.treatments(
  id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,start_interval_minutes,price_cents,selection_mode,
  requires_professional_assignment,is_active,config_enabled,booking_config
) values (
  'e6926fc8-f910-4b26-8c4b-53a9d27be7b7',
  '89000000-0000-4000-8000-000000000090','89000000-0000-4000-8000-000000000091',
  '89000000-0000-4000-8000-000000000092','H9 paquete QA','h9-paquete-qa',
  'Paquete aislado para pruebas H9','Tratamiento local usado para validar el panel de paquetes H9.',
  45,0,30,180000,'simple',true,false,false,null
);
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values('e6926fc8-f910-4b26-8c4b-53a9d27be7b7','89000000-0000-4000-8000-000000000092',true);

do $test$
declare
  admin_id uuid;
  fixture_treatment_id constant uuid := 'e6926fc8-f910-4b26-8c4b-53a9d27be7b7';
  offering_id constant uuid := '89000000-0000-4000-8000-000000000001';
  customer_id constant uuid := '89000000-0000-4000-8000-000000000002';
  booking_id constant uuid := '89000000-0000-4000-8000-000000000003';
  professional_id uuid;
  specialty_id uuid;
  rules jsonb := jsonb_build_object(
    'sessionsCount', 3,
    'validityDays', 90,
    'validityStartsFrom', 'purchase',
    'minDaysBetweenSessions', null,
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
    raise exception 'h9_fixture_prerequisite_missing';
  end if;

  execute 'alter table public.treatments disable trigger treatments_enforce_configured_readiness';
  update public.treatments set config_enabled = true, is_active = true, booking_config = jsonb_build_object(
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
    'durationRule', jsonb_build_object('type', 'per_session', 'durationMinutes', 45),
    'packageDefaults', rules,
    'conditionsText', null
  ) where id = fixture_treatment_id;
  execute 'alter table public.treatments enable trigger treatments_enforce_configured_readiness';

  insert into public.treatment_option_combos(
    id,treatment_id,name,description,kind,price_cents,duration_minutes,
    session_count,display_order,is_active,package_rules,package_rules_version
  ) values (
    offering_id,fixture_treatment_id,'Paquete H9 QA','', 'package',180000,45,
    3,9999,true,rules,1
  );
  insert into public.customers(id,full_name,phone,email)
  values(customer_id,'Cliente QA H9','3510000000',null);
  insert into public.bookings(
    id,idempotency_key,customer_id,treatment_id,specialty_id,professional_id,
    starts_at,ends_at,duration_snapshot_minutes,buffer_snapshot_minutes,
    base_price_snapshot_cents,applied_price_snapshot_cents,treatment_name_snapshot,
    status,treatment_option_combo_id,combo_name_snapshot,
    booking_order_v2_snapshot,package_charge_kind
  ) values (
    booking_id,'89000000-0000-4000-8000-000000000004',customer_id,
    fixture_treatment_id,specialty_id,professional_id,
    (current_date+10+time '10:00') at time zone 'America/Argentina/Cordoba',
    (current_date+10+time '10:45') at time zone 'America/Argentina/Cordoba',
    45,0,180000,180000,'H9 QA','awaiting_deposit',offering_id,
    'Paquete H9 QA','{"version":1,"purpose":"booking-order-v2"}'::jsonb,'standard'
  );
  perform set_config('h9.admin_id',admin_id::text,true);
end;
$test$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('h9.admin_id'),true);

do $test$
declare
  first_result jsonb;
  replay_result jsonb;
  package_id uuid;
  history_count integer;
  validity_before timestamptz;
  extension_result jsonb;
begin
  first_result := public.register_service_package_purchase_v2(
    '89000000-0000-4000-8000-000000000003','deposit_paid',
    '89000000-0000-4000-8000-000000000005'
  );
  replay_result := public.register_service_package_purchase_v2(
    '89000000-0000-4000-8000-000000000003','deposit_paid',
    '89000000-0000-4000-8000-000000000005'
  );
  if first_result is distinct from replay_result then raise exception 'h9_register_not_idempotent'; end if;
  begin
    perform public.register_service_package_purchase_v2(
      '89000000-0000-4000-8000-000000000003','paid_in_full',
      '89000000-0000-4000-8000-000000000005'
    );
    raise exception 'h9_purchase_payment_conflict_was_not_rejected';
  exception when invalid_parameter_value then
    null;
  end;
  if (select status from public.bookings where id='89000000-0000-4000-8000-000000000003') <> 'confirmed' then
    raise exception 'h9_paid_booking_not_confirmed';
  end if;
  select count(*) into history_count from public.booking_status_history
  where booking_id='89000000-0000-4000-8000-000000000003'
    and previous_status='awaiting_deposit' and next_status='confirmed';
  if history_count <> 1 then raise exception 'h9_status_history_not_idempotent'; end if;
  package_id := (first_result->>'packageId')::uuid;
  perform public.update_service_package_payment(package_id,'paid_in_full');
  perform public.update_service_package_payment(package_id,'paid_in_full');
  if (select payment_status from public.service_package_contracts where id=package_id) <> 'paid_in_full' then
    raise exception 'h9_payment_not_updated';
  end if;

  select validity_until into validity_before
  from public.service_package_contracts where id = package_id;
  extension_result := public.extend_service_package_validity_v2(
    package_id, validity_before, 30, 'Prueba de extensión H9',
    '89000000-0000-4000-8000-000000000006'
  );
  if extension_result is distinct from public.extend_service_package_validity_v2(
    package_id, validity_before, 30, 'Prueba de extensión H9',
    '89000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'h9_extension_not_idempotent';
  end if;
  begin
    perform public.extend_service_package_validity_v2(
      package_id, validity_before, 30, 'Prueba obsoleta H9',
      '89000000-0000-4000-8000-000000000007'
    );
    raise exception 'h9_stale_extension_was_not_rejected';
  exception when serialization_failure then
    null;
  end;
end;
$test$;

reset role;
do $test$
declare
  function_row record;
begin
  for function_row in
    select procedure.oid
    from pg_proc procedure join pg_namespace schema on schema.oid=procedure.pronamespace
    where schema.nspname='public'
      and procedure.proname in ('register_service_package_purchase_v2','update_service_package_payment','extend_service_package_validity_v2')
  loop
    if has_function_privilege('anon',function_row.oid,'execute')
      or not has_function_privilege('authenticated',function_row.oid,'execute') then
      raise exception 'h9_function_grant_mismatch';
    end if;
  end loop;
end;
$test$;

rollback;
\echo ok 1 - universal service package H9 assertions passed
