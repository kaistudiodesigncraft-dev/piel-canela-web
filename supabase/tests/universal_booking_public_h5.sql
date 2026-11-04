-- LOCAL ISOLATED DATABASE ONLY. No production execution. All rows roll back.
\set ON_ERROR_STOP on
\echo 1..1
begin;

do $$
begin
  if not has_column_privilege('anon', 'public.treatments', 'booking_config', 'select')
     or not has_column_privilege('anon', 'public.treatments', 'config_enabled', 'select') then
    raise exception 'anon cannot read the guarded universal booking columns';
  end if;
end;
$$;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('1c000000-0000-4000-8000-000000000001','authenticated','authenticated','h5-admin@example.invalid','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('1c000000-0000-4000-8000-000000000001','H5 admin local','admin',true);

insert into public.treatment_categories(id, name, slug, short_description, icon_name, is_active)
values('2c000000-0000-4000-8000-000000000001', 'H5 QA', 'h5-qa', 'Prueba pública aislada', 'UserFocus', true);
insert into public.specialties(id, name, slug, is_active)
values('3c000000-0000-4000-8000-000000000001', 'H5 QA', 'h5-qa', true);
insert into public.professionals(id, specialty_id, full_name, is_active)
values('3c000000-0000-4000-8000-000000000002', '3c000000-0000-4000-8000-000000000001', 'H5 QA professional', true);
insert into public.professional_specialties(professional_id, specialty_id)
values('3c000000-0000-4000-8000-000000000002', '3c000000-0000-4000-8000-000000000001');

insert into public.treatments(
  id, category_id, specialty_id, name, slug, short_description, description,
  duration_minutes, buffer_minutes, start_interval_minutes, price_cents,
  selection_mode, is_active, config_enabled, booking_config
) values
(
  '4c000000-0000-4000-8000-000000000001',
  '2c000000-0000-4000-8000-000000000001',
  '3c000000-0000-4000-8000-000000000001',
  'H5 público', 'h5-publico', 'Catálogo configurable público', 'Tratamiento aislado H5.',
  30, 10, 30, 100000, 'simple', false, false,
  '{
    "version":1,"mode":"combos_with_addons",
    "optionsLabel":{"singular":"opción","plural":"opciones"},
    "selectionMode":"multiple","minSelections":0,"maxSelections":null,
    "allowLooseOptions":true,"allowCombos":true,"allowAddons":true,
    "priceRule":{"type":"sum_with_volume_discount","minOptions":2,"discountPercent":10,"appliesTo":"loose_options_only"},
    "durationRule":{"type":"combo_plus_addons"}
  }'::jsonb
),
(
  '4c000000-0000-4000-8000-000000000002',
  '2c000000-0000-4000-8000-000000000001',
  '3c000000-0000-4000-8000-000000000001',
  'H5 no publicado', 'h5-no-publicado', 'Catálogo todavía privado', 'Tratamiento aislado H5.',
  30, 10, 30, 100000, 'simple', false, false,
  '{
    "version":1,"mode":"options",
    "optionsLabel":{"singular":"opción","plural":"opciones"},
    "selectionMode":"multiple","minSelections":1,"maxSelections":null,
    "allowLooseOptions":true,"allowCombos":false,"allowAddons":false,
    "priceRule":{"type":"sum_of_options"},
    "durationRule":{"type":"sum_of_options"}
  }'::jsonb
);

insert into public.treatment_professionals(treatment_id, professional_id, is_active)
values
('4c000000-0000-4000-8000-000000000001','3c000000-0000-4000-8000-000000000002',true),
('4c000000-0000-4000-8000-000000000002','3c000000-0000-4000-8000-000000000002',true);

insert into public.treatment_options(id, treatment_id, name, price_cents, duration_minutes, display_order, is_active)
values
('5c000000-0000-4000-8000-000000000001','4c000000-0000-4000-8000-000000000001','Incluida',100000,15,1,true),
('5c000000-0000-4000-8000-000000000002','4c000000-0000-4000-8000-000000000001','Adicional',50000,10,2,true),
('5c000000-0000-4000-8000-000000000003','4c000000-0000-4000-8000-000000000001','Pausada',50000,10,3,false),
('5c000000-0000-4000-8000-000000000004','4c000000-0000-4000-8000-000000000002','Todavía privada',50000,10,1,true),
('5c000000-0000-4000-8000-000000000005','4c000000-0000-4000-8000-000000000001','Auxiliar matriz',50000,10,4,false);

insert into public.treatment_option_combos(
  id, treatment_id, name, kind, price_cents, duration_minutes, session_count, display_order, is_active
) values
(
  '6c000000-0000-4000-8000-000000000001',
  '4c000000-0000-4000-8000-000000000001',
  'Propuesta H5', 'combo', 140000, 25, 1, 1, true
),
(
  '6c000000-0000-4000-8000-000000000002',
  '4c000000-0000-4000-8000-000000000001',
  'Auxiliar matriz', 'combo', 140000, 25, 1, 2, false
);
insert into public.treatment_option_combo_items(
  id, treatment_id, combo_id, option_id, role, display_order
) values
('7c000000-0000-4000-8000-000000000001','4c000000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000001','included',1),
('7c000000-0000-4000-8000-000000000002','4c000000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000001','5c000000-0000-4000-8000-000000000002','addon',2);

-- Activation happens only after the catalog is complete, as the panel does.
update public.treatments
set config_enabled = true, is_active = true
where id = '4c000000-0000-4000-8000-000000000001';
update public.treatments
set is_active = true
where id = '4c000000-0000-4000-8000-000000000002';

do $$
declare
  function_owner text;
  function_is_definer boolean;
  function_config text[];
  owner_can_login boolean;
  owner_is_super boolean;
  owner_bypasses_rls boolean;
begin
  select role.rolname, procedure.prosecdef, procedure.proconfig
  into function_owner, function_is_definer, function_config
  from pg_proc as procedure
  join pg_namespace as schema on schema.oid = procedure.pronamespace
  join pg_roles as role on role.oid = procedure.proowner
  where schema.nspname = 'public'
    and procedure.proname = 'is_public_configured_treatment'
    and pg_get_function_identity_arguments(procedure.oid) = 'requested_treatment_id uuid';

  if function_owner <> 'booking_catalog_policy_reader' or not function_is_definer then
    raise exception 'H5 function owner/security mode mismatch';
  end if;
  if function_config is null or not ('search_path=""' = any(function_config)) then
    raise exception 'H5 function search_path is not fixed';
  end if;

  select rolcanlogin, rolsuper, rolbypassrls
  into owner_can_login, owner_is_super, owner_bypasses_rls
  from pg_roles where rolname = function_owner;
  if owner_can_login or owner_is_super or owner_bypasses_rls then
    raise exception 'H5 owner has excessive role attributes';
  end if;
  if has_schema_privilege(function_owner, 'public', 'CREATE')
    or has_table_privilege(function_owner, 'public.treatments', 'INSERT,UPDATE,DELETE') then
    raise exception 'H5 owner has excessive object privileges';
  end if;
  if not has_column_privilege(function_owner, 'public.treatments', 'id', 'SELECT')
    or not has_column_privilege(function_owner, 'public.treatments', 'is_active', 'SELECT')
    or not has_column_privilege(function_owner, 'public.treatments', 'config_enabled', 'SELECT') then
    raise exception 'H5 owner is missing its minimal read privileges';
  end if;
  if exists (
      select 1
      from pg_proc as procedure
      join pg_namespace as schema on schema.oid = procedure.pronamespace
      cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
      where schema.nspname = 'public'
        and procedure.proname = 'is_public_configured_treatment'
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
    or not has_function_privilege('anon', 'public.is_public_configured_treatment(uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.is_public_configured_treatment(uuid)', 'EXECUTE') then
    raise exception 'H5 function grants mismatch';
  end if;
end;
$$;

create function pg_temp.expect_write_denied(statement text)
returns void
language plpgsql
as $function$
declare
  affected integer;
begin
  execute statement;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'matrix_write_allowed';
  end if;
exception when insufficient_privilege then
  return;
end;
$function$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  if (select count(*) from public.treatment_options where treatment_id='4c000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'public options policy exposed a paused row or hid an active row';
  end if;
  if (select count(*) from public.treatment_option_combos where treatment_id='4c000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'public combinations policy mismatch';
  end if;
  if (select count(*) from public.treatment_option_combo_items where treatment_id='4c000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'public combination relations policy mismatch';
  end if;
  if exists (select 1 from public.treatment_options where treatment_id='4c000000-0000-4000-8000-000000000002') then
    raise exception 'catalog leaked before config activation';
  end if;
  perform pg_temp.expect_write_denied($sql$insert into public.treatment_options(id,treatment_id,name,price_cents,duration_minutes,display_order,is_active) values('5c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','Anon denied',10000,10,10,false)$sql$);
  perform pg_temp.expect_write_denied($sql$update public.treatment_options set name='Anon denied' where id='5c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$delete from public.treatment_options where id='5c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$insert into public.treatment_option_combos(id,treatment_id,name,kind,price_cents,duration_minutes,session_count,display_order,is_active) values('6c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','Anon denied','combo',10000,10,1,10,false)$sql$);
  perform pg_temp.expect_write_denied($sql$update public.treatment_option_combos set name='Anon denied' where id='6c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$delete from public.treatment_option_combos where id='6c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$insert into public.treatment_option_combo_items(id,treatment_id,combo_id,option_id,role,display_order) values('7c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000005','included',10)$sql$);
  perform pg_temp.expect_write_denied($sql$update public.treatment_option_combo_items set display_order=10 where id='7c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$delete from public.treatment_option_combo_items where id='7c000000-0000-4000-8000-000000000001'$sql$);
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.treatment_options where treatment_id='4c000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'authenticated public read mismatch';
  end if;
  if exists (select 1 from public.treatment_options where treatment_id='4c000000-0000-4000-8000-000000000002') then
    raise exception 'authenticated catalog leaked before config activation';
  end if;
  perform pg_temp.expect_write_denied($sql$insert into public.treatment_options(id,treatment_id,name,price_cents,duration_minutes,display_order,is_active) values('5c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','Auth denied',10000,10,10,false)$sql$);
  perform pg_temp.expect_write_denied($sql$update public.treatment_options set name='Auth denied' where id='5c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$delete from public.treatment_options where id='5c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$insert into public.treatment_option_combos(id,treatment_id,name,kind,price_cents,duration_minutes,session_count,display_order,is_active) values('6c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','Auth denied','combo',10000,10,1,10,false)$sql$);
  perform pg_temp.expect_write_denied($sql$update public.treatment_option_combos set name='Auth denied' where id='6c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$delete from public.treatment_option_combos where id='6c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$insert into public.treatment_option_combo_items(id,treatment_id,combo_id,option_id,role,display_order) values('7c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000002','5c000000-0000-4000-8000-000000000005','included',10)$sql$);
  perform pg_temp.expect_write_denied($sql$update public.treatment_option_combo_items set display_order=10 where id='7c000000-0000-4000-8000-000000000001'$sql$);
  perform pg_temp.expect_write_denied($sql$delete from public.treatment_option_combo_items where id='7c000000-0000-4000-8000-000000000001'$sql$);
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"1c000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

do $$
begin
  if (select count(*) from public.treatment_options where treatment_id in ('4c000000-0000-4000-8000-000000000001','4c000000-0000-4000-8000-000000000002')) <> 5
    or (select count(*) from public.treatment_option_combos where treatment_id='4c000000-0000-4000-8000-000000000001') <> 2
    or (select count(*) from public.treatment_option_combo_items where treatment_id='4c000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'admin select matrix mismatch';
  end if;

  insert into public.treatment_options(id,treatment_id,name,price_cents,duration_minutes,display_order,is_active)
  values('5c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','Admin matrix',10000,10,10,false);
  update public.treatment_options set name='Admin matrix updated' where id='5c000000-0000-4000-8000-000000000010';

  insert into public.treatment_option_combos(id,treatment_id,name,kind,price_cents,duration_minutes,session_count,display_order,is_active)
  values('6c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','Admin matrix','combo',10000,10,1,10,false);
  update public.treatment_option_combos set name='Admin matrix updated' where id='6c000000-0000-4000-8000-000000000010';

  insert into public.treatment_option_combo_items(id,treatment_id,combo_id,option_id,role,display_order)
  values('7c000000-0000-4000-8000-000000000010','4c000000-0000-4000-8000-000000000001','6c000000-0000-4000-8000-000000000010','5c000000-0000-4000-8000-000000000010','included',10);
  update public.treatment_option_combo_items set display_order=11 where id='7c000000-0000-4000-8000-000000000010';
  delete from public.treatment_option_combo_items where id='7c000000-0000-4000-8000-000000000010';
  delete from public.treatment_option_combos where id='6c000000-0000-4000-8000-000000000010';
  delete from public.treatment_options where id='5c000000-0000-4000-8000-000000000010';
end;
$$;

reset role;
rollback;
\echo ok 1 - universal booking public H5 complete RLS matrix passed
