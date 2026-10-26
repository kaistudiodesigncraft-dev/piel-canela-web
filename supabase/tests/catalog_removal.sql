-- LOCAL ISOLATED DATABASE ONLY. Every fixture and mutation rolls back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('17000000-0000-4000-8000-000000000001','authenticated','authenticated','catalog-removal@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('17000000-0000-4000-8000-000000000001','Catalog test manager','manager',true);
insert into public.specialties(id,name,slug,is_active)
values('27000000-0000-4000-8000-000000000001','Removal test','removal-test',true);
insert into public.professionals(id,specialty_id,full_name,is_active,display_order)
values('57000000-0000-4000-8000-000000000002','27000000-0000-4000-8000-000000000001','Removal test professional',true,999);
insert into public.treatments(id,category_id,specialty_id,professional_id,name,slug,short_description,description,price_cents,duration_minutes,buffer_minutes,start_interval_minutes,is_active,display_order)
select ('37000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,category.id,'27000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000002',
 'Removal test '||n,'removal-test-'||n,'Descripción suficientemente larga.',
 'Descripción completa suficientemente larga para este tratamiento.',10000,30,0,15,false,900+n
from generate_series(1,6) n cross join lateral(select id from public.treatment_categories order by display_order limit 1) category;
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
select ('37000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'57000000-0000-4000-8000-000000000002',true
from generate_series(1,6) n;
update public.treatments set is_active=true where id::text like '37000000-0000-4000-8000-%';
insert into public.monthly_specials(id,treatment_id,title,short_description,detail,image_path,image_alt,special_price_cents,starts_at,ends_at,is_active,display_order,created_by)
select ('47000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('37000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'Special test '||n,'Descripción suficientemente larga.','Detalle suficientemente largo para la promoción.',
 'test/immutable.webp','Imagen de prueba',5000,now(),now()+interval '1 day',false,1,'17000000-0000-4000-8000-000000000001'
from generate_series(1,6) n;
insert into public.customers(id,full_name,phone)
values('57000000-0000-4000-8000-000000000001','Test customer','5493510000001');
insert into public.bookings(id,booking_code,idempotency_key,customer_id,treatment_id,monthly_special_id,specialty_id,starts_at,ends_at,status,duration_snapshot_minutes,buffer_snapshot_minutes,base_price_snapshot_cents,applied_price_snapshot_cents,treatment_name_snapshot)
values('67000000-0000-4000-8000-000000000001','PC-REMOVE01','77000000-0000-4000-8000-000000000001','57000000-0000-4000-8000-000000000001','37000000-0000-4000-8000-000000000004','47000000-0000-4000-8000-000000000004','27000000-0000-4000-8000-000000000001',now()-interval '2 days',now()-interval '2 days'+interval '30 minutes','completed',30,0,10000,5000,'Historical snapshot');
update public.treatments set is_active=false where id::text like '37000000-0000-4000-8000-%';
insert into private.booking_guard_config(singleton,secret_hash)
values(true,encode(extensions.digest(repeat('t',32),'sha256'),'hex'))
on conflict(singleton) do update set secret_hash=excluded.secret_hash;
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare v timestamptz; versions jsonb; result jsonb; blocked boolean;
begin
  -- Manager can delete an independent, unused special; its parent survives.
  select updated_at into v from public.monthly_specials where id='47000000-0000-4000-8000-000000000001';
  result:=public.remove_monthly_special_safely('47000000-0000-4000-8000-000000000001',v,repeat('t',32));
  if result->>'outcome'<>'deleted' or not exists(select 1 from public.treatments where id='37000000-0000-4000-8000-000000000001') then raise exception 'Independent deletion failed'; end if;
  -- Cascade is explicit and atomic for records without history.
  select updated_at into v from public.treatments where id='37000000-0000-4000-8000-000000000002';
  select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at)) into versions from public.monthly_specials where treatment_id='37000000-0000-4000-8000-000000000002';
  perform public.remove_treatment_with_specials('37000000-0000-4000-8000-000000000002','delete',null,v,versions,repeat('t',32));
  if exists(select 1 from public.monthly_specials where id='47000000-0000-4000-8000-000000000002') then raise exception 'Special was not removed'; end if;
  -- Preserve and reassign specials, paused, without changing their price.
  select updated_at into v from public.treatments where id='37000000-0000-4000-8000-000000000003';
  select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at)) into versions from public.monthly_specials where treatment_id='37000000-0000-4000-8000-000000000003';
  perform public.remove_treatment_with_specials('37000000-0000-4000-8000-000000000003','reassign','37000000-0000-4000-8000-000000000001',v,versions,repeat('t',32));
  if not exists(select 1 from public.monthly_specials where id='47000000-0000-4000-8000-000000000003' and treatment_id='37000000-0000-4000-8000-000000000001' and not is_active and special_price_cents=5000) then raise exception 'Reassignment lost data'; end if;
  -- Any historical reservation requires archive, including a completed one.
  select updated_at into v from public.treatments where id='37000000-0000-4000-8000-000000000004';
  select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at)) into versions from public.monthly_specials where treatment_id='37000000-0000-4000-8000-000000000004';
  blocked:=false;
  begin perform public.remove_treatment_with_specials('37000000-0000-4000-8000-000000000004','delete',null,v,versions,repeat('t',32));
  exception when foreign_key_violation then blocked:=true; end;
  if not blocked then raise exception 'History destruction was accepted'; end if;
  result:=public.remove_treatment_with_specials('37000000-0000-4000-8000-000000000004','archive',null,v,versions,repeat('t',32));
  if result->>'outcome'<>'archived' or not exists(select 1 from public.bookings where booking_code='PC-REMOVE01' and applied_price_snapshot_cents=5000 and treatment_name_snapshot='Historical snapshot') then raise exception 'Archive changed booking'; end if;
  select updated_at into v from public.monthly_specials where id='47000000-0000-4000-8000-000000000004';
  result:=public.remove_monthly_special_safely('47000000-0000-4000-8000-000000000004',v,repeat('t',32));
  if result->>'outcome'<>'archived' then raise exception 'Used special was not archived'; end if;
  -- Invalid destination, stale snapshot and wrong guard leave everything intact.
  select updated_at into v from public.treatments where id='37000000-0000-4000-8000-000000000005';
  select jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at)) into versions from public.monthly_specials where treatment_id='37000000-0000-4000-8000-000000000005';
  blocked:=false;
  begin perform public.remove_treatment_with_specials('37000000-0000-4000-8000-000000000005','reassign','37000000-0000-4000-8000-000000000099',v,versions,repeat('t',32));
  exception when invalid_parameter_value then blocked:=true; end;
  if not blocked then raise exception 'Invalid target was accepted'; end if;
  blocked:=false;
  begin perform public.remove_treatment_with_specials('37000000-0000-4000-8000-000000000005','delete',null,v,'[]',repeat('t',32));
  exception when serialization_failure then blocked:=true; end;
  if not blocked then raise exception 'Missing special snapshot accepted'; end if;
  blocked:=false;
  begin perform public.remove_treatment_with_specials('37000000-0000-4000-8000-000000000005','delete',null,v,versions,repeat('x',32));
  exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Invalid guard accepted'; end if;
  if not exists(select 1 from public.monthly_specials where id='47000000-0000-4000-8000-000000000005') then raise exception 'Failure lost special'; end if;
end $$;
reset role;
-- Audit data is intentionally private: verify as owner, not by widening manager RLS.
do $$ begin
  if not exists(select 1 from public.audit_log where actor_id='17000000-0000-4000-8000-000000000001' and table_name='treatments' and action='delete') then raise exception 'Manager deletion not audited'; end if;
end $$;
set local role anon;
do $$ begin
  if has_function_privilege('anon','public.remove_monthly_special_safely(uuid,timestamptz,text)','execute')
    or has_function_privilege('anon','public.remove_treatment_with_specials(uuid,text,uuid,timestamptz,jsonb,text)','execute') then
    raise exception 'Anonymous removal exposed';
  end if;
end $$;
rollback;
