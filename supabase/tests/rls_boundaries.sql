\set ON_ERROR_STOP on
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values
('11000000-0000-0000-0000-000000000001','authenticated','authenticated','manager-boundary@example.test','',now(),'{}','{}'),
('11000000-0000-0000-0000-000000000002','authenticated','authenticated','owner-boundary@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values
('11000000-0000-0000-0000-000000000001','Boundary Manager','manager',true),
('11000000-0000-0000-0000-000000000002','Boundary Owner','admin',true);

set local role anon;
do $$ begin
  if has_table_privilege('anon','public.treatments','INSERT') then
    raise exception 'anon may insert treatments';
  end if;
  if has_table_privilege('anon','public.audit_log','SELECT') then
    raise exception 'anon may read audit log';
  end if;
end $$;

select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ declare affected integer; visible integer; begin
  if public.is_owner() then raise exception 'manager was treated as owner'; end if;
  update public.profiles set role='admin'
  where user_id='11000000-0000-0000-0000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'manager escalated its own role'; end if;
  select count(*) into visible from public.audit_log;
  if visible <> 0 then raise exception 'manager received raw audit rows'; end if;
  perform public.list_operational_audit_history(10);
end $$;

select set_config('request.jwt.claims','{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
do $$ begin
  if not public.is_owner() then raise exception 'admin owner boundary failed'; end if;
end $$;

rollback;
