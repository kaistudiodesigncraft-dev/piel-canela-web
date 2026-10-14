\set ON_ERROR_STOP on
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('12000000-0000-0000-0000-000000000001','authenticated','authenticated','professional-delete@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('12000000-0000-0000-0000-000000000001','Delete test owner','admin',true);
insert into public.specialties(id,name,slug,description,is_active,display_order)
values('32000000-0000-0000-0000-000000000001','Delete test specialty','delete-test-specialty','Test',true,999);
insert into public.professionals(id,specialty_id,full_name,public_name,is_active,display_order)
values
('42000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','Archived duplicate','Archived duplicate',true,998),
('42000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000001','Active professional','Active professional',true,999);
insert into public.treatments(
  id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  price_cents,duration_minutes,buffer_minutes,start_interval_minutes,is_active,display_order
)
select
  '52000000-0000-0000-0000-000000000001',category.id,'32000000-0000-0000-0000-000000000001',null,
  'Delete test treatment','delete-test-treatment','Descripción de prueba suficientemente larga.',
  'Descripción de prueba suficientemente larga para validar el tratamiento.',1000,30,0,15,false,999
from public.treatment_categories category order by category.display_order limit 1;
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values
('52000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000001',false),
('52000000-0000-0000-0000-000000000001','42000000-0000-0000-0000-000000000002',true);

insert into private.booking_guard_config(singleton,secret_hash)
values(true,encode(extensions.digest(repeat('d',32),'sha256'),'hex'))
on conflict(singleton) do update set secret_hash=excluded.secret_hash;

select set_config('request.jwt.claims','{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;

do $$
declare archived_count bigint; active_count bigint; blocked boolean := false;
begin
  select treatment_count into archived_count
  from public.get_professional_usage_counts()
  where professional_id='42000000-0000-0000-0000-000000000001';
  select treatment_count into active_count
  from public.get_professional_usage_counts()
  where professional_id='42000000-0000-0000-0000-000000000002';
  if archived_count <> 0 or active_count <> 1 then
    raise exception 'usage counts include archived assignments';
  end if;

  perform public.delete_professional_if_unlinked(
    '42000000-0000-0000-0000-000000000001',repeat('d',32));
  if exists(select 1 from public.professionals where id='42000000-0000-0000-0000-000000000001')
    or exists(select 1 from public.treatment_professionals where professional_id='42000000-0000-0000-0000-000000000001') then
    raise exception 'unlinked duplicate was not removed';
  end if;

  begin
    perform public.delete_professional_if_unlinked(
      '42000000-0000-0000-0000-000000000002',repeat('d',32));
  exception when foreign_key_violation then blocked := true; end;
  if not blocked then raise exception 'active professional deletion was accepted'; end if;
end $$;

rollback;
