\set ON_ERROR_STOP on
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('10000000-0000-0000-0000-000000000092','authenticated','authenticated','atomic-editor@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('10000000-0000-0000-0000-000000000092','Test manager','manager',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000092","role":"authenticated"}',true);
set local role authenticated;
insert into public.specialties(id,name,slug,description,is_active,display_order)
values('30000000-0000-0000-0000-000000000092','Atomic editor','atomic-editor','Test',true,99);
select public.save_admin_professional('40000000-0000-0000-0000-000000000092',
  '{"specialty_id":"30000000-0000-0000-0000-000000000092","full_name":"Original","is_active":true,"display_order":1}',
  '{}',null,false);
do $$ declare stamp timestamptz; rejected boolean := false; begin
  select updated_at into stamp from public.professionals where id='40000000-0000-0000-0000-000000000092';
  begin
    perform public.save_admin_professional('40000000-0000-0000-0000-000000000092',
      '{"specialty_id":"30000000-0000-0000-0000-000000000099","full_name":"Must not persist","is_active":true,"display_order":1}',
      '{}',stamp,false);
  exception when check_violation then rejected:=true; end;
  if not rejected then raise exception 'invalid specialty accepted'; end if;
  if not exists(select 1 from public.professionals where id='40000000-0000-0000-0000-000000000092' and full_name='Original')
    or not exists(select 1 from public.professional_specialties where professional_id='40000000-0000-0000-0000-000000000092') then
    raise exception 'atomicity violated'; end if;
  rejected:=false;
  begin
    perform public.save_admin_professional('40000000-0000-0000-0000-000000000092',
      '{"specialty_id":"30000000-0000-0000-0000-000000000092","full_name":"Stale","is_active":true,"display_order":1}',
      '{}',stamp-interval '1 second',false);
  exception when serialization_failure then rejected:=true; end;
  if not rejected then raise exception 'stale version accepted'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.save_admin_professional(gen_random_uuid(),'{}','{}',null,false);
    raise exception 'anonymous write accepted';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
