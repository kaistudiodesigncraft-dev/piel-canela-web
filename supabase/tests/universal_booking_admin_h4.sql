-- LOCAL ISOLATED DATABASE ONLY. No production execution. All rows roll back.
\set ON_ERROR_STOP on
\echo 1..1
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('1b000000-0000-4000-8000-000000000001','authenticated','authenticated','h4-local@example.invalid','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('1b000000-0000-4000-8000-000000000001','H4 local','admin',true);
insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('2b000000-0000-4000-8000-000000000001','H4 local','h4-local','Prueba local H4','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('3b000000-0000-4000-8000-000000000001','H4 local','h4-local',true);
insert into public.treatments(
  id,category_id,specialty_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,start_interval_minutes,price_cents,
  selection_mode,is_active,config_enabled,booking_config
) values (
  '4b000000-0000-4000-8000-000000000001',
  '2b000000-0000-4000-8000-000000000001',
  '3b000000-0000-4000-8000-000000000001',
  'H4 configurable','h4-configurable','Descripción H4','Tratamiento aislado H4.',
  30,10,30,100000,'simple',false,false,
  '{
    "version":1,"mode":"combos_with_addons",
    "optionsLabel":{"singular":"opción","plural":"opciones"},
    "selectionMode":"multiple","minSelections":0,"maxSelections":null,
    "allowLooseOptions":true,"allowCombos":true,"allowAddons":true,
    "priceRule":{"type":"combo_price"},
    "durationRule":{"type":"combo_plus_addons"}
  }'::jsonb
);
insert into public.treatment_options(id,treatment_id,name,price_cents,duration_minutes,display_order,is_active)
values
('5b000000-0000-4000-8000-000000000001','4b000000-0000-4000-8000-000000000001','Base A',100000,10,1,true),
('5b000000-0000-4000-8000-000000000002','4b000000-0000-4000-8000-000000000001','Adicional',50000,5,2,true),
('5b000000-0000-4000-8000-000000000003','4b000000-0000-4000-8000-000000000001','Base B',120000,12,3,true);

-- The production data-only restore preserves audit IDs. Align the local-only
-- sequence before exercising an audited insert.
select setval(
  pg_get_serial_sequence('public.audit_log', 'id'),
  greatest(coalesce((select max(id) from public.audit_log), 0), 1),
  true
);

select set_config('request.jwt.claims','{"sub":"1b000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1b000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare
  saved_id uuid;
  saved_version timestamptz;
  rejected boolean := false;
begin
  saved_id := public.save_treatment_option_combo_v1(
    null,
    '4b000000-0000-4000-8000-000000000001',
    'Propuesta H4','Prueba transaccional','combo',250000,30,1,1,true,
    array['5b000000-0000-4000-8000-000000000001']::uuid[],
    array['5b000000-0000-4000-8000-000000000002']::uuid[],
    null
  );
  if (select count(*) from public.treatment_option_combo_items where combo_id=saved_id) <> 2 then
    raise exception 'initial option roles mismatch';
  end if;
  select updated_at into saved_version from public.treatment_option_combos where id=saved_id;

  perform public.save_treatment_option_combo_v1(
    saved_id,
    '4b000000-0000-4000-8000-000000000001',
    'Propuesta H4 actualizada','Prueba transaccional','combo',270000,35,1,1,true,
    array['5b000000-0000-4000-8000-000000000003']::uuid[],
    array['5b000000-0000-4000-8000-000000000002']::uuid[],
    saved_version
  );
  if exists (
    select 1 from public.treatment_option_combo_items
    where combo_id=saved_id and option_id='5b000000-0000-4000-8000-000000000001'
  ) then raise exception 'old included relation survived replacement'; end if;
  if not exists (
    select 1 from public.treatment_option_combo_items
    where combo_id=saved_id and option_id='5b000000-0000-4000-8000-000000000003' and role='included'
  ) then raise exception 'new included relation missing'; end if;

  begin
    perform public.save_treatment_option_combo_v1(
      saved_id,
      '4b000000-0000-4000-8000-000000000001',
      'Versión obsoleta','Prueba','combo',270000,35,1,1,false,
      array['5b000000-0000-4000-8000-000000000003']::uuid[],
      '{}'::uuid[],
      saved_version - interval '1 second'
    );
  exception when others then rejected := SQLERRM = 'combination_version_conflict'; end;
  if not rejected then raise exception 'stale update accepted'; end if;

  rejected := false;
  begin
    update public.treatment_options set is_active=false
    where id='5b000000-0000-4000-8000-000000000003';
  exception when others then rejected := SQLERRM = 'option_used_by_active_combination'; end;
  if not rejected then raise exception 'active combination option was paused'; end if;

  update public.treatments set config_enabled=true
  where id='4b000000-0000-4000-8000-000000000001';
  if not exists (
    select 1 from public.treatments
    where id='4b000000-0000-4000-8000-000000000001' and config_enabled
  ) then raise exception 'config activation did not update fixture'; end if;
  rejected := false;
  begin
    update public.treatments set booking_config='{
      "version":1,"mode":"simple",
      "optionsLabel":{"singular":"opción","plural":"opciones"},
      "selectionMode":"single","minSelections":0,"maxSelections":0,
      "allowLooseOptions":false,"allowCombos":false,"allowAddons":false,
      "priceRule":{"type":"fixed","priceCents":100000},
      "durationRule":{"type":"fixed","durationMinutes":30}
    }'::jsonb
    where id='4b000000-0000-4000-8000-000000000001';
  exception when others then rejected := SQLERRM = 'simple_config_has_active_catalog'; end;
  if not rejected then raise exception 'incompatible active catalog accepted'; end if;
end;
$$;

reset role;
rollback;
\echo ok 1 - universal booking admin H4 assertions passed
