\set ON_ERROR_STOP on

create table if not exists private.h8_concurrency_restore (
  treatment_id uuid primary key,
  booking_config jsonb,
  config_enabled boolean not null,
  is_active boolean not null,
  updated_at timestamptz not null
);
create table if not exists private.h8_concurrency_fixture (
  singleton boolean primary key default true check (singleton),
  treatment_created boolean not null
);
create table if not exists public.h8_concurrency_results (
  worker text primary key,
  outcome text not null
);
truncate public.h8_concurrency_results;
grant insert on public.h8_concurrency_results to authenticated;
truncate private.h8_concurrency_restore;
truncate private.h8_concurrency_fixture;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('88100000-0000-4000-8000-000000000098','authenticated','authenticated','h8-concurrency@example.invalid','',now(),'{}','{}')
on conflict(id) do nothing;
insert into public.profiles(user_id,full_name,role,is_active)
values('88100000-0000-4000-8000-000000000098','H8 concurrency local','admin',true)
on conflict(user_id) do update set role='admin',is_active=true;

do $setup$
declare
  actor_id constant uuid := '88100000-0000-4000-8000-000000000098';
  fixture_treatment_id constant uuid := 'e6926fc8-f910-4b26-8c4b-53a9d27be7b7';
  professional_id constant uuid := '88100000-0000-4000-8000-000000000009';
  fixture_specialty_id uuid;
  rules jsonb := '{
    "sessionsCount": 2,
    "validityDays": 60,
    "validityStartsFrom": "purchase",
    "minDaysBetweenSessions": 2,
    "releaseNoticeHours": 48,
    "maxReschedulesPerSession": 1,
    "absenceConsumesSession": true,
    "lateReleaseConsumesSession": true,
    "depositPercent": null,
    "conditionsText": null
  }'::jsonb;
  initial_start timestamptz := ((current_date + 10) + time '10:00') at time zone 'America/Argentina/Cordoba';
  fixture_created boolean := false;
begin
  select treatment.specialty_id into fixture_specialty_id
  from public.treatments treatment where treatment.id = fixture_treatment_id;

  if fixture_specialty_id is null then
    fixture_created := true;
    fixture_specialty_id := '88100000-0000-4000-8000-000000000091';
    insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
    values('88100000-0000-4000-8000-000000000090','H8 concurrency','h8-concurrency','Categoría aislada para concurrencia.','UserFocus',true);
    insert into public.specialties(id,name,slug,is_active)
    values(fixture_specialty_id,'H8 concurrency','h8-concurrency',true);
    insert into public.treatments(
      id,category_id,specialty_id,name,slug,short_description,description,
      duration_minutes,buffer_minutes,start_interval_minutes,price_cents,
      selection_mode,requires_professional_assignment,is_active,config_enabled
    ) values (
      fixture_treatment_id,'88100000-0000-4000-8000-000000000090',fixture_specialty_id,
      'H8 concurrencia','h8-concurrencia','Tratamiento aislado de concurrencia',
      'Tratamiento local usado únicamente para probar el bloqueo transaccional.',
      30,0,30,100000,'simple',true,false,false
    );
  end if;

  insert into private.h8_concurrency_fixture(singleton,treatment_created)
  values(true,fixture_created);
  insert into private.h8_concurrency_restore(treatment_id,booking_config,config_enabled,is_active,updated_at)
  select id,booking_config,config_enabled,is_active,updated_at from public.treatments
  where id=fixture_treatment_id;

  insert into public.professionals(
    id,specialty_id,full_name,public_name,is_active,display_order
  ) values (
    professional_id,fixture_specialty_id,'AAA Profesional QA H8','Profesional QA H8',true,0
  );
  insert into public.treatment_professionals(
    treatment_id,professional_id,is_active,display_order
  ) values(fixture_treatment_id,professional_id,true,0);
  insert into public.professional_specialties(professional_id,specialty_id)
  values(professional_id,fixture_specialty_id);

  execute 'alter table public.treatments disable trigger treatments_enforce_configured_readiness';
  update public.treatments set config_enabled = true, is_active = true, booking_config = jsonb_build_object(
    'version',1,'mode','package','optionsLabel',jsonb_build_object('singular','paquete','plural','paquetes'),
    'selectionMode','single','minSelections',0,'maxSelections',0,
    'allowLooseOptions',false,'allowCombos',true,'allowAddons',false,
    'priceRule',jsonb_build_object('type','package_price'),
    'durationRule',jsonb_build_object('type','per_session','durationMinutes',30),
    'packageDefaults',rules,'conditionsText',null
  ) where id = fixture_treatment_id;
  execute 'alter table public.treatments enable trigger treatments_enforce_configured_readiness';

  insert into public.treatment_option_combos(
    id,treatment_id,name,description,kind,price_cents,duration_minutes,
    session_count,display_order,is_active,package_rules,package_rules_version
  ) values (
    '88100000-0000-4000-8000-000000000001',fixture_treatment_id,'H8 Concurrencia','',
    'package',100000,30,2,9999,true,rules,1
  );
  insert into public.customers(id,full_name,phone)
  values('88100000-0000-4000-8000-000000000002','Cliente QA concurrencia','3510000001');
  insert into public.availability_exceptions(
    specialty_id,kind,starts_at,ends_at,internal_reason,created_by
  ) values (
    fixture_specialty_id,'open',((current_date+15)+time '09:00') at time zone 'America/Argentina/Cordoba',
    ((current_date+15)+time '18:00') at time zone 'America/Argentina/Cordoba','H8 concurrency',actor_id
  );
  insert into public.professional_availability_exceptions(
    professional_id,kind,starts_at,ends_at,reason
  ) values (
    professional_id,'open',((current_date+15)+time '09:00') at time zone 'America/Argentina/Cordoba',
    ((current_date+15)+time '18:00') at time zone 'America/Argentina/Cordoba','H8 concurrency'
  );
  insert into public.bookings(
    id,idempotency_key,customer_id,treatment_id,specialty_id,professional_id,
    starts_at,ends_at,duration_snapshot_minutes,buffer_snapshot_minutes,
    base_price_snapshot_cents,applied_price_snapshot_cents,treatment_name_snapshot,
    status,treatment_option_combo_id,combo_name_snapshot,booking_order_v2_snapshot,package_charge_kind
  ) values (
    '88100000-0000-4000-8000-000000000003','88100000-0000-4000-8000-000000000004',
    '88100000-0000-4000-8000-000000000002',fixture_treatment_id,fixture_specialty_id,professional_id,
    initial_start,initial_start+interval '30 minutes',30,0,100000,100000,'H8 Concurrencia',
    'confirmed','88100000-0000-4000-8000-000000000001','H8 Concurrencia',
    '{"version":1,"purpose":"booking-order-v2"}'::jsonb,'standard'
  );
  insert into public.service_package_contracts(
    id,idempotency_key,customer_id,treatment_id,offering_id,initial_booking_id,
    offering_name_snapshot,total_sessions,price_total_snapshot_cents,
    price_per_session_snapshot_cents,duration_per_session_snapshot_minutes,
    buffer_snapshot_minutes,rules_snapshot,rules_version,validity_starts_from,
    validity_starts_at,validity_until,payment_status,paid_in_full_at,status,created_by
  ) values (
    '88100000-0000-4000-8000-000000000005','88100000-0000-4000-8000-000000000006',
    '88100000-0000-4000-8000-000000000002',fixture_treatment_id,
    '88100000-0000-4000-8000-000000000001','88100000-0000-4000-8000-000000000003',
    'H8 Concurrencia',2,100000,50000,30,0,rules,1,'purchase',now(),now()+interval '60 days',
    'paid_in_full',now(),'active',actor_id
  );
  update public.bookings set service_package_id='88100000-0000-4000-8000-000000000005'
  where id='88100000-0000-4000-8000-000000000003';
  insert into public.service_package_sessions(package_id,booking_id,session_number,status)
  values('88100000-0000-4000-8000-000000000005','88100000-0000-4000-8000-000000000003',1,'reserved');
end;
$setup$;
