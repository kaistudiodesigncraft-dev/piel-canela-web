\set ON_ERROR_STOP on
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('10000000-0000-0000-0000-000000000001','authenticated','authenticated','audit@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('10000000-0000-0000-0000-000000000001','Audit Manager','manager',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;

insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active,display_order)
values('20000000-0000-0000-0000-000000000001','Audit','audit','Categoría aislada para integridad','UserFocus',true,90);
insert into public.specialties(id,name,slug,description,is_active,display_order) values
('30000000-0000-0000-0000-000000000001','Especialidad primaria','audit-primary','Prueba',true,90),
('30000000-0000-0000-0000-000000000002','Especialidad secundaria','audit-secondary','Prueba',true,91);
insert into public.professionals(id,specialty_id,full_name,public_name,is_active,display_order) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Profesional asignada','Profesional asignada',true,1),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Profesional no asignada','Profesional no asignada',true,2);
insert into public.professional_specialties(professional_id,specialty_id) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002'),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002');

-- A professional may be valid through the many-to-many relation even when their legacy specialty differs.
select public.save_admin_treatment(
  '50000000-0000-0000-0000-000000000001',
  jsonb_build_object(
    'category_id','20000000-0000-0000-0000-000000000001','specialty_id','30000000-0000-0000-0000-000000000002',
    'professional_id','40000000-0000-0000-0000-000000000001','requires_professional_assignment',true,
    'name','Tratamiento auditado','slug','tratamiento-auditado','short_description','Descripción suficiente para publicar',
    'description','Detalle completo y suficiente para validar el guardado transaccional.','expectations',jsonb_build_array('Resultado claro'),
    'characteristics',jsonb_build_array('Característica'),'duration_minutes',60,'buffer_minutes',15,
    'start_interval_minutes',30,'selection_mode','simple','price_cents',2500000,'image_path',null,'image_alt',null,
    'image_focal_x',0.5,'image_focal_y',0.5,'is_active',true,'display_order',0
  ),array['40000000-0000-0000-0000-000000000001']::uuid[],true,null
);

do $$ begin
  if not exists(select 1 from public.treatments where id='50000000-0000-0000-0000-000000000001' and is_active) then
    raise exception 'atomic treatment was not published';
  end if;
  if public.find_available_professional_for_booking('50000000-0000-0000-0000-000000000001',now()+interval '3 days',now()+interval '3 days 75 minutes',
    '40000000-0000-0000-0000-000000000002') is not null then
    raise exception 'unassigned professional leaked into treatment candidates';
  end if;
end $$;

-- An old editor version must not overwrite a later edit.
do $$ declare stamp timestamptz; rejected boolean := false; begin
  select updated_at - interval '1 second' into stamp from public.treatments where id='50000000-0000-0000-0000-000000000001';
  update public.treatments set description='Otro operador guardó un cambio posterior que no debe perderse.'
    where id='50000000-0000-0000-0000-000000000001';
  begin
    perform public.save_admin_treatment('50000000-0000-0000-0000-000000000001',
      jsonb_build_object('name','No debe persistir'),array['40000000-0000-0000-0000-000000000001']::uuid[],false,stamp);
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'stale treatment edit was accepted'; end if;
  if (select name from public.treatments where id='50000000-0000-0000-0000-000000000001') <> 'Tratamiento auditado' then
    raise exception 'stale edit changed treatment';
  end if;
end $$;

-- Availability uses the professional assignment and contracted duration.
insert into public.availability_rules(specialty_id,weekday,start_time,end_time,is_active)
select '30000000-0000-0000-0000-000000000002',extract(dow from current_date+14)::smallint,'09:00','18:00',true;
insert into public.professional_availability_rules(professional_id,weekday,start_time,end_time,is_active)
select '40000000-0000-0000-0000-000000000001',extract(dow from current_date+14)::smallint,'09:00','18:00',true;
insert into public.customers(id,full_name,phone) values('60000000-0000-0000-0000-000000000001','Cliente auditado','3510000000');
insert into public.bookings(id,idempotency_key,customer_id,treatment_id,specialty_id,professional_id,
  starts_at,ends_at,duration_snapshot_minutes,buffer_snapshot_minutes,base_price_snapshot_cents,
  applied_price_snapshot_cents,treatment_name_snapshot,status)
values('70000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001',
  ((current_date+14)+time '10:00') at time zone 'America/Argentina/Cordoba',
  ((current_date+14)+time '11:15') at time zone 'America/Argentina/Cordoba',60,15,2500000,2500000,'Tratamiento auditado','confirmed');

select * from public.reschedule_admin_booking('70000000-0000-0000-0000-000000000001',
  ((current_date+14)+time '12:00') at time zone 'America/Argentina/Cordoba');
do $$ begin
  if not exists(select 1 from public.bookings where id='70000000-0000-0000-0000-000000000001'
    and (starts_at at time zone 'America/Argentina/Cordoba')::time=time '12:00'
    and (ends_at at time zone 'America/Argentina/Cordoba')::time=time '13:15' and reschedule_count=1) then
    raise exception 'reschedule did not preserve contracted duration';
  end if;
  begin
    perform public.reschedule_admin_booking('70000000-0000-0000-0000-000000000001',
      ((current_date+14)+time '20:00') at time zone 'America/Argentina/Cordoba');
    raise exception 'off-hours reschedule was accepted';
  exception when exclusion_violation then null; end;
end $$;

-- Package slots keep the original specialty and the treatment's explicit
-- professional assignment; another free professional from the specialty must
-- not make an occupied hour appear available.
set local role postgres;
update public.treatments set is_active=false,selection_mode='closed_combo'
where id='50000000-0000-0000-0000-000000000001';
insert into public.treatment_combos(
  id,treatment_id,name,description,audience,mode,session_count,fixed_price_cents,
  validity_days,is_active,display_order
) values(
  '80000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',
  'Paquete auditado','Paquete local para probar disponibilidad','shared','package',3,6000000,90,false,1
);
insert into public.depilation_zones(id,name,audience,reference_price_cents,duration_minutes,is_active,display_order)
values('82000000-0000-0000-0000-000000000001','Zona auditada','shared',2500000,60,true,1);
insert into public.treatment_combo_zones(combo_id,zone_id,display_order)
values('80000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001',1);
update public.treatment_combos set is_active=true where id='80000000-0000-0000-0000-000000000001';
update public.business_settings set depilation_combos_enabled=true where singleton=true;
update public.treatments set is_active=true where id='50000000-0000-0000-0000-000000000001';
insert into public.customer_packages(
  id,customer_id,treatment_id,combo_id,initial_booking_id,combo_name_snapshot,zones_snapshot,
  total_sessions,duration_snapshot_minutes,buffer_snapshot_minutes,fixed_price_snapshot_cents,
  price_per_session_snapshot_cents,savings_snapshot_cents,validity_days_snapshot,activated_at,expires_at,status
) values(
  '81000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001','Paquete auditado','[]'::jsonb,
  3,60,15,6000000,2000000,0,90,now(),now()+interval '90 days','active'
);
insert into public.bookings(
  id,idempotency_key,customer_id,treatment_id,specialty_id,professional_id,starts_at,ends_at,
  duration_snapshot_minutes,buffer_snapshot_minutes,base_price_snapshot_cents,
  applied_price_snapshot_cents,treatment_name_snapshot,status
) values(
  '70000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000002',
  '60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001',
  ((current_date+14)+time '14:00') at time zone 'America/Argentina/Cordoba',
  ((current_date+14)+time '15:15') at time zone 'America/Argentina/Cordoba',60,15,2500000,2500000,
  'Tratamiento auditado','confirmed'
);
set local role authenticated;
do $$ begin
  if exists(
    select 1 from public.get_available_slots_for_package(
      '81000000-0000-0000-0000-000000000001',current_date+14
    ) slot where (slot.starts_at at time zone 'America/Argentina/Cordoba')::time = time '14:00'
  ) then
    raise exception 'package slot ignored the assigned professional conflict';
  end if;
end $$;

-- Protected destructive actions allow five attempts per hour and can be reset
-- only after a successful operation.
do $$ declare allowed boolean; i integer; begin
  for i in 1..5 loop
    select public.register_admin_protected_action_attempt('delete_test') into allowed;
    if not allowed then raise exception 'protected action blocked too early at attempt %',i; end if;
  end loop;
  select public.register_admin_protected_action_attempt('delete_test') into allowed;
  if allowed then raise exception 'protected action did not block the sixth attempt'; end if;
  perform public.clear_admin_protected_action_attempts('delete_test');
  select public.register_admin_protected_action_attempt('delete_test') into allowed;
  if not allowed then raise exception 'protected action was not reset'; end if;
end $$;

-- A restore is accepted only while the audited version is still the current
-- version. Replaying the same event must not overwrite the restoration audit.
do $$ declare audit_id bigint; rejected boolean := false; begin
  update public.treatments set short_description='Versión accidental para restaurar'
  where id='50000000-0000-0000-0000-000000000001';
  select id into audit_id from public.list_operational_audit_history(500)
  where table_name='treatments' and record_id='50000000-0000-0000-0000-000000000001' and action='update'
  order by id desc limit 1;
  perform public.restore_admin_audit_record(audit_id,'Prueba de restauración segura');
  if (select short_description from public.treatments where id='50000000-0000-0000-0000-000000000001')
    = 'Versión accidental para restaurar' then
    raise exception 'restore did not recover the previous value';
  end if;
  begin
    perform public.restore_admin_audit_record(audit_id,'No debe sobrescribir cambios posteriores');
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'stale restore was accepted'; end if;
end $$;

rollback;
