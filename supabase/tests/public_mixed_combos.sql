\set ON_ERROR_STOP on
-- Run only in isolated development/test DB. All fixtures roll back.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('17000000-0000-0000-0000-000000000001','authenticated','authenticated','mixed-combo-qa@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('17000000-0000-0000-0000-000000000001','Combo QA','manager',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
-- Fixtures use the test owner; public visibility is exercised as anon below.
reset role;

insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active,display_order)
values('27000000-0000-0000-0000-000000000001','Combo QA','combo-qa','Prueba aislada','UserFocus',true,90);
insert into public.specialties(id,name,slug,description,is_active,display_order)
values('37000000-0000-0000-0000-000000000001','Combo QA','combo-qa','Prueba aislada',true,90);
update public.business_settings set depilation_combos_enabled=true where singleton;

insert into public.treatments(id,category_id,specialty_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,start_interval_minutes,price_cents,selection_mode,requires_professional_assignment,is_active)
values
('47000000-0000-0000-0000-000000000001','27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',
 'QA Mixto','qa-mixto','Descripción de prueba suficiente','Descripción detallada para comprobar publicación y permisos.',30,5,15,100000,'combo_with_extras',false,false),
('47000000-0000-0000-0000-000000000002','27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',
 'QA Cerrado','qa-cerrado','Descripción de prueba suficiente','Descripción detallada para comprobar publicación y permisos.',30,5,15,100000,'closed_combo',false,false),
('47000000-0000-0000-0000-000000000003','27000000-0000-0000-0000-000000000001','37000000-0000-0000-0000-000000000001',
 'QA Oculto','qa-oculto','Descripción de prueba suficiente','Descripción detallada para comprobar publicación y permisos.',30,5,15,100000,'combo_with_extras',false,false);

insert into public.depilation_zones(id,name,audience,reference_price_cents,duration_minutes,is_active)
values('57000000-0000-0000-0000-000000000001','QA Zona','shared',100000,30,true);
insert into public.treatment_combos(id,treatment_id,name,fixed_price_cents,is_active,allow_public_extras)
values
('67000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001','QA Mixto',80000,false,true),
('67000000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000002','QA Cerrado',80000,false,false),
('67000000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000003','QA Padre oculto',80000,false,false),
('67000000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000001','QA Borrador',80000,false,false);
insert into public.treatment_combo_zones(combo_id,zone_id)
select id,'57000000-0000-0000-0000-000000000001' from public.treatment_combos
where id in ('67000000-0000-0000-0000-000000000001','67000000-0000-0000-0000-000000000002','67000000-0000-0000-0000-000000000003','67000000-0000-0000-0000-000000000004');
update public.treatment_combos set is_active=true
where id in ('67000000-0000-0000-0000-000000000001','67000000-0000-0000-0000-000000000002','67000000-0000-0000-0000-000000000003');
update public.treatments set is_active=true
where id in ('47000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000002');
insert into public.treatment_combo_extras(id,treatment_id,name,audience,price_cents,duration_minutes,is_active)
values('77000000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001','QA Extra','shared',20000,10,true);
insert into public.treatment_combo_allowed_extras(combo_id,extra_id)
values('67000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ declare selected record; begin
  if (select count(*) from public.treatment_combos where id in (
    '67000000-0000-0000-0000-000000000001','67000000-0000-0000-0000-000000000002')) <> 2 then
    raise exception 'Public catalog must include both closed and mixed combos';
  end if;
  if exists(select 1 from public.treatment_combos where id in (
    '67000000-0000-0000-0000-000000000003','67000000-0000-0000-0000-000000000004')) then
    raise exception 'Draft combo or unpublished treatment was exposed';
  end if;
  if not exists(select 1 from public.treatment_combo_zones
    where combo_id='67000000-0000-0000-0000-000000000001') then
    raise exception 'Mixed combo zones not visible';
  end if;
  if not exists(select 1 from public.treatment_combo_allowed_extras link
    join public.treatment_combo_extras extra on extra.id=link.extra_id
    where link.combo_id='67000000-0000-0000-0000-000000000001') then
    raise exception 'Mixed combo extras not visible';
  end if;
  select * into selected from public.resolve_booking_selection_v2(
    '47000000-0000-0000-0000-000000000001','67000000-0000-0000-0000-000000000001',null,
    array['77000000-0000-0000-0000-000000000001']::uuid[]);
  if selected.applied_price_cents <> 100000 or selected.duration_minutes <> 40
    or selected.buffer_minutes <> 5 or jsonb_array_length(selected.extras) <> 1 then
    raise exception 'Booking selection lost combo extras, duration or price';
  end if;
end $$;

-- Verify the feature flag itself still gates reads, independently of publication.
reset role;
select set_config('request.jwt.claims','{"sub":"17000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
update public.treatments set is_active=false where selection_mode in ('closed_combo','combo_with_extras');
update public.business_settings set depilation_combos_enabled=false where singleton;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  if exists(select 1 from public.treatment_combos) then
    raise exception 'Disabled selector exposed combos';
  end if;
end $$;
rollback;
