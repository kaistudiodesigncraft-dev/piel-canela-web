-- LOCAL ISOLATED DATABASE ONLY. No production execution. All rows roll back.
\set ON_ERROR_STOP on
\echo 1..1
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('1c000000-0000-4000-8000-000000000001','authenticated','authenticated','treatment-conflict@example.invalid','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('1c000000-0000-4000-8000-000000000001','Treatment conflict local','admin',true);
insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('2c000000-0000-4000-8000-000000000001','Conflict local','conflict-local','Prueba local de concurrencia','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('3c000000-0000-4000-8000-000000000001','Conflict local','conflict-local',true);
insert into public.treatments(
  id,category_id,specialty_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,start_interval_minutes,price_cents,
  selection_mode,is_active,display_order
) values (
  '4c000000-0000-4000-8000-000000000001',
  '2c000000-0000-4000-8000-000000000001',
  '3c000000-0000-4000-8000-000000000001',
  'Original conflict','original-conflict','Descripción de prueba','Tratamiento aislado para validar el conflicto.',
  30,10,30,100000,'simple',false,1
);

select set_config('request.jwt.claims','{"sub":"1c000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','1c000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare
  current_version timestamptz;
  rejected_code text;
  rejected_message text;
begin
  select updated_at into current_version
  from public.treatments
  where id='4c000000-0000-4000-8000-000000000001';

  begin
    perform public.save_admin_treatment(
      '4c000000-0000-4000-8000-000000000001',
      '{"name":"Must not persist"}'::jsonb,
      '{}'::uuid[],
      false,
      current_version - interval '1 second'
    );
  exception when others then
    get stacked diagnostics rejected_code = returned_sqlstate, rejected_message = message_text;
  end;

  if rejected_code is distinct from 'PT409' or rejected_message is distinct from 'treatment_version_conflict' then
    raise exception 'stale treatment returned % / % instead of PT409', rejected_code, rejected_message;
  end if;
  if not exists (
    select 1 from public.treatments
    where id='4c000000-0000-4000-8000-000000000001' and name='Original conflict'
  ) then
    raise exception 'stale treatment mutation changed persisted data';
  end if;
end;
$$;

reset role;
rollback;
\echo ok 1 - stale treatment edit returns a non-retryable HTTP conflict
