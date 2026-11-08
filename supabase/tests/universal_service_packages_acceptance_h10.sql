-- LOCAL ISOLATED DATABASE ONLY. Complete Release 2 acceptance; all rows roll back.
\set ON_ERROR_STOP on
\echo 1..1
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('8d000000-0000-4000-8000-000000000001','authenticated','authenticated','h10-admin@example.invalid','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('8d000000-0000-4000-8000-000000000001','H10 admin local','admin',true);
insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('8d000000-0000-4000-8000-000000000002','H10 QA','h10-qa','Aceptación local','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('8d000000-0000-4000-8000-000000000003','H10 QA','h10-qa',true);
insert into public.professionals(id,specialty_id,full_name,is_active)
values('8d000000-0000-4000-8000-000000000004','8d000000-0000-4000-8000-000000000003','H10 professional',true);
insert into public.professional_specialties(professional_id,specialty_id)
values('8d000000-0000-4000-8000-000000000004','8d000000-0000-4000-8000-000000000003');

insert into public.treatments(
  id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,start_interval_minutes,price_cents,selection_mode,
  requires_professional_assignment,is_active,config_enabled,booking_config
) values (
  '8d000000-0000-4000-8000-000000000005',
  '8d000000-0000-4000-8000-000000000002',
  '8d000000-0000-4000-8000-000000000003',
  '8d000000-0000-4000-8000-000000000004',
  'H10 paquete','h10-paquete','Paquete de aceptación local','No se publica fuera de esta transacción.',
  45,10,30,180000,'simple',true,false,false,
  '{
    "version":1,"mode":"package",
    "optionsLabel":{"singular":"paquete","plural":"paquetes"},
    "selectionMode":"single","minSelections":0,"maxSelections":0,
    "allowLooseOptions":false,"allowCombos":true,"allowAddons":false,
    "priceRule":{"type":"package_price"},
    "durationRule":{"type":"per_session","durationMinutes":45},
    "packageDefaults":{
      "sessionsCount":4,"validityDays":120,"validityStartsFrom":"purchase",
      "minDaysBetweenSessions":null,"releaseNoticeHours":48,
      "maxReschedulesPerSession":1,"absenceConsumesSession":true,
      "lateReleaseConsumesSession":true,"depositPercent":50,"conditionsText":null
    },
    "conditionsText":null
  }'::jsonb
);
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values('8d000000-0000-4000-8000-000000000005','8d000000-0000-4000-8000-000000000004',true);
insert into public.treatment_option_combos(
  id,treatment_id,name,description,kind,price_cents,duration_minutes,session_count,
  display_order,is_active,package_rules,package_rules_version
) values (
  '8d000000-0000-4000-8000-000000000006',
  '8d000000-0000-4000-8000-000000000005',
  'Plan H10','Cuatro sesiones','package',180000,45,4,1,true,
  '{
    "sessionsCount":4,"validityDays":120,"validityStartsFrom":"purchase",
    "minDaysBetweenSessions":null,"releaseNoticeHours":48,
    "maxReschedulesPerSession":1,"absenceConsumesSession":true,
    "lateReleaseConsumesSession":true,"depositPercent":50,"conditionsText":null
  }'::jsonb,1
);

-- The H10 readiness guard must allow only a complete package catalog.
update public.treatments set config_enabled=true,is_active=true
where id='8d000000-0000-4000-8000-000000000005';

insert into public.availability_rules(specialty_id,weekday,start_time,end_time,is_active)
select '8d000000-0000-4000-8000-000000000003',weekday,'09:00','18:00',true
from generate_series(0,6) weekday;
insert into private.booking_guard_config(singleton,secret_hash)
values(true,encode(extensions.digest(repeat('q',64),'sha256'),'hex'))
on conflict(singleton) do update set secret_hash=excluded.secret_hash;

create temp table h10_state(
  initial_booking_id uuid,
  package_id uuid,
  second_booking_id uuid,
  third_booking_id uuid,
  initial_starts_at timestamptz,
  validity_before_expiry timestamptz
);
grant all on h10_state to anon,authenticated;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);

do $test$
declare
  context_payload jsonb;
  order_payload jsonb;
  payload_text text;
  signed_text text;
  selected_slot timestamptz;
  created record;
  missing_package_rejected boolean := false;
  package_option_rejected boolean := false;
begin
  if not exists (
    select 1 from public.treatment_option_combos
    where id='8d000000-0000-4000-8000-000000000006'
      and kind='package' and package_rules->>'releaseNoticeHours'='48'
  ) then raise exception 'h10_public_package_not_visible'; end if;

  begin
    perform public.get_booking_order_context_v2(
      '8d000000-0000-4000-8000-000000000005',null,'{}'::uuid[]
    );
  exception when others then
    missing_package_rejected := sqlerrm='package_selection_invalid';
  end;
  begin
    perform public.get_booking_order_context_v2(
      '8d000000-0000-4000-8000-000000000005',
      '8d000000-0000-4000-8000-000000000006',
      array['8d000000-0000-4000-8000-000000000016'::uuid]
    );
  exception when others then
    package_option_rejected := sqlerrm='package_selection_invalid';
  end;
  if not missing_package_rejected or not package_option_rejected then
    raise exception 'h10_invalid_package_selection_was_accepted';
  end if;

  context_payload := public.get_booking_order_context_v2(
    '8d000000-0000-4000-8000-000000000005',
    '8d000000-0000-4000-8000-000000000006','{}'::uuid[]
  );
  if context_payload->>'source' <> 'configured'
    or context_payload->'combination'->>'kind' <> 'package'
    or context_payload->'combination'->>'sessionCount' <> '4' then
    raise exception 'h10_package_context_mismatch';
  end if;

  order_payload := jsonb_build_object(
    'items',jsonb_build_array(jsonb_build_object(
      'id','8d000000-0000-4000-8000-000000000006','kind','combination',
      'name','Plan H10','priceCents',180000,'durationMinutes',45
    )),
    'subtotalCents',180000,'looseOptionsSubtotalCents',0,
    'discountPercent',0,'discountCents',0,'totalCents',180000,'durationMinutes',45
  );
  payload_text := jsonb_build_object(
    'purpose','booking-order-v2','expiresAt',now()+interval '15 minutes',
    'selection',context_payload->'selection','context',context_payload,'order',order_payload
  )::text;
  signed_text := encode(extensions.hmac(
    convert_to(payload_text,'UTF8'),
    convert_to(encode(extensions.digest(repeat('q',64),'sha256'),'hex'),'UTF8'),
    'sha256'
  ),'hex');

  select starts_at into selected_slot
  from public.get_available_slots_for_booking_order_v2(payload_text,signed_text,current_date+7)
  order by starts_at limit 1;
  if selected_slot is null then raise exception 'h10_initial_slot_missing'; end if;

  select * into created from public.create_booking_for_booking_order_v2(
    payload_text,signed_text,selected_slot,
    '8d000000-0000-4000-8000-000000000007',
    'Cliente H10','3510000000',null,null,
    '8d000000-0000-4000-8000-000000000008',repeat('f',64),repeat('q',64)
  );
  insert into h10_state(initial_booking_id,initial_starts_at)
  values(created.booking_id,selected_slot);
end;
$test$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8d000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $test$
declare
  state_row h10_state%rowtype;
  purchase jsonb;
  created_package_id uuid;
  second_slot timestamptz;
  third_slot timestamptz;
  second_result jsonb;
  third_result jsonb;
  result_payload jsonb;
  frozen_rules jsonb;
begin
  select * into state_row from h10_state limit 1;
  purchase := public.register_service_package_purchase_v2(
    state_row.initial_booking_id,'deposit_paid','8d000000-0000-4000-8000-000000000009'
  );
  created_package_id := (purchase->>'packageId')::uuid;
  update h10_state set package_id=created_package_id;
  if purchase->>'balance' <> '3'
    or (select status from public.bookings where id=state_row.initial_booking_id) <> 'confirmed' then
    raise exception 'h10_purchase_or_initial_session_mismatch';
  end if;

  select rules_snapshot into frozen_rules from public.service_package_contracts where id=created_package_id;
  update public.treatment_option_combos
  set package_rules=jsonb_set(package_rules,'{releaseNoticeHours}','24'::jsonb)
  where id='8d000000-0000-4000-8000-000000000006';
  update public.treatments
  set booking_config=jsonb_set(booking_config,'{packageDefaults,releaseNoticeHours}','24'::jsonb)
  where id='8d000000-0000-4000-8000-000000000005';
  if (select rules_snapshot from public.service_package_contracts where id=created_package_id) is distinct from frozen_rules
    or frozen_rules->>'releaseNoticeHours' <> '48' then
    raise exception 'h10_frozen_rules_changed';
  end if;

  result_payload := public.manage_service_package_session(
    created_package_id,'complete','8d000000-0000-4000-8000-000000000010',
    state_row.initial_booking_id,null,state_row.initial_starts_at+interval '1 hour',null
  );
  if result_payload->>'balance' <> '3' then raise exception 'h10_complete_balance_mismatch'; end if;

  select starts_at into second_slot
  from public.get_available_slots_for_service_package(created_package_id,current_date+14,null)
  order by starts_at limit 1;
  second_result := public.manage_service_package_session(
    created_package_id,'reserve','8d000000-0000-4000-8000-000000000011',
    null,second_slot,now(),null
  );
  if second_result->>'balance' <> '2' then raise exception 'h10_second_reserve_balance_mismatch'; end if;
  update h10_state set second_booking_id=(second_result->>'bookingId')::uuid;
  result_payload := public.manage_service_package_session(
    created_package_id,'release','8d000000-0000-4000-8000-000000000012',
    (second_result->>'bookingId')::uuid,null,second_slot-interval '72 hours',null
  );
  if result_payload->>'suggestedOutcome' <> 'released'
    or result_payload->>'isException' <> 'false'
    or result_payload->>'balance' <> '3' then
    raise exception 'h10_timely_release_mismatch';
  end if;

  select starts_at into third_slot
  from public.get_available_slots_for_service_package(created_package_id,current_date+21,null)
  order by starts_at limit 1;
  third_result := public.manage_service_package_session(
    created_package_id,'reserve','8d000000-0000-4000-8000-000000000013',
    null,third_slot,now(),null
  );
  update h10_state set third_booking_id=(third_result->>'bookingId')::uuid;
  result_payload := public.manage_service_package_session(
    created_package_id,'release','8d000000-0000-4000-8000-000000000014',
    (third_result->>'bookingId')::uuid,null,third_slot-interval '1 hour',
    'Excepción confirmada durante aceptación H10'
  );
  if result_payload->>'suggestedOutcome' <> 'lost'
    or result_payload->>'sessionStatus' <> 'released'
    or result_payload->>'isException' <> 'true'
    or result_payload->>'balance' <> '3' then
    raise exception 'h10_late_release_exception_mismatch';
  end if;
  if not exists (
    select 1 from public.audit_log
    where table_name='service_package_sessions'
      and record_id=(third_result->>'sessionId')::uuid
      and new_data->>'event'='package_outcome_exception'
      and not (new_data ?| array['customer','phone','email'])
  ) then raise exception 'h10_exception_audit_missing_or_sensitive'; end if;

  update h10_state set validity_before_expiry=(
    select validity_until from public.service_package_contracts where id=created_package_id
  );
end;
$test$;

reset role;
update public.service_package_contracts
set validity_starts_at=now()-interval '2 days',
    validity_until=now()-interval '1 day',
    status='active'
where id=(select package_id from h10_state limit 1);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"8d000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $test$
declare
  state_row h10_state%rowtype;
  expired_at timestamptz;
  extended jsonb;
  rejected boolean := false;
  remaining_balance integer;
begin
  select * into state_row from h10_state limit 1;
  select validity_until into expired_at from public.service_package_contracts where id=state_row.package_id;
  begin
    perform 1 from public.get_available_slots_for_service_package(state_row.package_id,current_date+1,null);
  exception when others then
    rejected := sqlerrm='package_not_available';
  end;
  if not rejected then raise exception 'h10_expired_package_was_available'; end if;

  extended := public.extend_service_package_validity_v2(
    state_row.package_id,expired_at,30,'Extensión de aceptación H10',
    '8d000000-0000-4000-8000-000000000015'
  );
  select contract.total_sessions - count(session.id) filter (
    where session.status in ('reserved','completed','lost')
  )::integer
  into remaining_balance
  from public.service_package_contracts contract
  left join public.service_package_sessions session on session.package_id=contract.id
  where contract.id=state_row.package_id
  group by contract.total_sessions;
  if extended->>'status' <> 'active'
    or (extended->>'validityUntil')::timestamptz <= now()
    or remaining_balance <> 3 then
    raise exception 'h10_extension_or_final_balance_mismatch';
  end if;
  if (select count(*) from public.service_package_sessions where package_id=state_row.package_id) <> 3
    or (select count(*) from public.service_package_sessions where package_id=state_row.package_id and status='completed') <> 1
    or (select count(*) from public.service_package_sessions where package_id=state_row.package_id and status='released') <> 2 then
    raise exception 'h10_final_session_timeline_mismatch';
  end if;
end;
$test$;

reset role;
rollback;
\echo ok 1 - universal service package H10 acceptance passed
