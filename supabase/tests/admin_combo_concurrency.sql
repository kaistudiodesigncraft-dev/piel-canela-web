-- LOCAL ISOLATED DATABASE ONLY. No production execution. All rows roll back.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('1a000000-0000-4000-8000-000000000001','authenticated','authenticated','combo-lock-qa@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('1a000000-0000-4000-8000-000000000001','Combo lock QA','manager',true);
select set_config('request.jwt.claims','{"sub":"1a000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('2a000000-0000-4000-8000-000000000001','Combo lock QA','combo-lock-qa','Categoría de prueba aislada','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('3a000000-0000-4000-8000-000000000001','Combo lock QA','combo-lock-qa',true);
insert into public.treatments(
  id,category_id,specialty_id,name,slug,short_description,description,duration_minutes,
  buffer_minutes,start_interval_minutes,price_cents,selection_mode,requires_professional_assignment,is_active
) values(
  '5a000000-0000-4000-8000-000000000001','2a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000001','Combo lock QA','combo-lock-qa',
  'Descripción breve de prueba','Descripción detallada suficiente para una prueba aislada.',
  30,10,15,0,'closed_combo',false,false
);
insert into public.depilation_zones(id,name,audience,reference_price_cents,duration_minutes,is_active)
values('6a000000-0000-4000-8000-000000000001','Zona lock QA','shared',1000000,15,true);
insert into public.treatment_combos(id,treatment_id,name,audience,fixed_price_cents,is_active)
values('7a000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','Combo lock QA','shared',1000000,false);
insert into public.treatment_combo_zones(combo_id,zone_id)
values('7a000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001');

set local role authenticated;
do $$
declare
  original_version timestamptz;
  rejected boolean := false;
begin
  select updated_at into original_version
  from public.treatment_combos
  where id='7a000000-0000-4000-8000-000000000001';

  perform public.save_depilation_combo_v4(
    '7a000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001',
    'Combo lock QA actualizado','', 'shared','single_session',1,1200000,20,null,1,false,
    jsonb_build_array('6a000000-0000-4000-8000-000000000001'),
    'fixed_price',null,null,null,false,'[]'::jsonb,original_version
  );

  begin
    perform public.save_depilation_combo_v4(
      '7a000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001',
      'Sobrescritura obsoleta','', 'shared','single_session',1,900000,20,null,1,false,
      jsonb_build_array('6a000000-0000-4000-8000-000000000001'),
      'fixed_price',null,null,null,false,'[]'::jsonb,original_version - interval '1 second'
    );
  exception when serialization_failure then
    rejected := SQLERRM = 'combo_version_conflict';
  end;

  if not rejected then
    raise exception 'stale combo update was accepted';
  end if;
  if (select name from public.treatment_combos where id='7a000000-0000-4000-8000-000000000001') <> 'Combo lock QA actualizado' then
    raise exception 'stale update changed the combo';
  end if;
end;
$$;
reset role;

rollback;
