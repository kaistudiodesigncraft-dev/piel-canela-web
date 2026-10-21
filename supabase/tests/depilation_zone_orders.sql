-- LOCAL ISOLATED DATABASE ONLY. No production execution. All rows roll back.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('19000000-0000-4000-8000-000000000001','authenticated','authenticated','zone-order-qa@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('19000000-0000-4000-8000-000000000001','Zone order QA','manager',true);
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('29000000-0000-4000-8000-000000000001','Zone QA','zone-order-qa','Prueba aislada','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('39000000-0000-4000-8000-000000000001','Zone QA','zone-order-qa',true);
insert into public.professionals(id,specialty_id,full_name,is_active)
values('49000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001','Zone QA professional',true);
insert into public.treatments(id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,start_interval_minutes,price_cents,selection_mode,requires_professional_assignment,is_active)
values('59000000-0000-4000-8000-000000000001','29000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001',
  '49000000-0000-4000-8000-000000000001','Zone QA','zone-order-qa','Descripción de prueba suficiente',
  'Descripción detallada para verificar el circuito aislado.',30,15,15,0,'combo_with_extras',true,false);
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values('59000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001',true);
insert into public.depilation_zones(id,name,audience,reference_price_cents,duration_minutes,is_active) values
('69000000-0000-4000-8000-000000000001','Zone QA included','shared',3000000,30,true),
('69000000-0000-4000-8000-000000000002','Zone QA axilas','women',1800000,15,true),
('69000000-0000-4000-8000-000000000003','Zone QA piernas','men',3000000,30,true),
('69000000-0000-4000-8000-000000000004','Zone QA no price','men',0,15,true),
('69000000-0000-4000-8000-000000000005','Zone QA inactive','shared',1000000,15,false);
insert into public.treatment_combos(id,treatment_id,name,audience,fixed_price_cents,is_active)
values('79000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001','Zone QA fixed','shared',2500000,false);
insert into public.treatment_combo_zones(combo_id,zone_id)
values('79000000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001');
update public.treatment_combos set is_active=true where id='79000000-0000-4000-8000-000000000001';
update public.business_settings set depilation_combos_enabled=true,depilation_discount_percent=10,maximum_advance_days=60 where singleton;
update public.treatments set is_active=true where id='59000000-0000-4000-8000-000000000001';
insert into public.availability_rules(specialty_id,weekday,start_time,end_time,is_active)
select '39000000-0000-4000-8000-000000000001',extract(dow from current_date+14)::smallint,'09:00','18:00',true;
insert into private.booking_guard_config(singleton,secret_hash)
values(true,encode(extensions.digest(repeat('q',64),'sha256'),'hex'))
on conflict(singleton) do update set secret_hash=excluded.secret_hash;

create temp table qa_quote(payload text,signature text,booking_id uuid);
grant all on qa_quote to anon,authenticated;
set local role authenticated;
do $$ begin
  update public.business_settings set depilation_discount_percent=10 where singleton;
  begin
    update public.business_settings set depilation_discount_percent=101 where singleton;
    raise exception 'invalid discount accepted';
  exception when check_violation then null; end;
  if not exists(select 1 from public.depilation_zones where id='69000000-0000-4000-8000-000000000004') then
    raise exception 'manager cannot see incomplete zone';
  end if;
end $$;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$
declare ctx jsonb; p text; sig text; b record; duplicate record; slot timestamptz; rejected boolean;
begin
  if (select count(*) from public.depilation_zones where id::text like '69000000-%')<>3 then
    raise exception 'RLS exposed inactive/unpriced zone or hid standalone zone';
  end if;
  if (select depilation_discount_percent from public.business_settings where singleton)<>10 then
    raise exception 'public cannot read discount';
  end if;
  begin
    update public.business_settings set depilation_discount_percent=99 where singleton;
    raise exception 'anon write authorized';
  exception when insufficient_privilege then null; end;
  rejected:=false;
  begin
    perform public.get_depilation_order_context('59000000-0000-4000-8000-000000000001',null,array['69000000-0000-4000-8000-000000000004']::uuid[]);
  exception when others then rejected:=SQLERRM='zone_not_available'; end;
  if not rejected then raise exception 'unpriced zone accepted'; end if;
  rejected:=false;
  begin
    perform public.get_depilation_order_context('59000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001',array['69000000-0000-4000-8000-000000000001']::uuid[]);
  exception when others then rejected:=SQLERRM='zone_already_in_combo'; end;
  if not rejected then raise exception 'included zone repeated'; end if;
  -- Server's pure TS calculation is covered by unit tests. Here we sign its
  -- known expected result: fixed combo 25000 + loose 48000 - 10% = 68200 ARS.
  ctx:=public.get_depilation_order_context('59000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001',
    array['69000000-0000-4000-8000-000000000002','69000000-0000-4000-8000-000000000003']::uuid[]);
  if ctx->'combo'->>'priceCents'<>'2500000' or jsonb_array_length(ctx->'zones')<>2 then raise exception 'context mismatch'; end if;
  p:=jsonb_build_object('purpose','depilation-order-v1','expiresAt',now()+interval '15 minutes',
    'zoneIds',jsonb_build_array('69000000-0000-4000-8000-000000000002','69000000-0000-4000-8000-000000000003'),
    'context',ctx,'order',jsonb_build_object('subtotalCents',7300000,'totalCents',6820000,'durationMinutes',75,
    'discountPercent',10,'discountCents',480000))::text;
  sig:=encode(extensions.hmac(convert_to(p,'UTF8'),convert_to(encode(extensions.digest(repeat('q',64),'sha256'),'hex'),'UTF8'),'sha256'),'hex');
  insert into qa_quote(payload,signature) values(p,sig);
  rejected:=false;
  begin
    perform public.get_available_slots_for_zone_order(replace(p,'6820000','1'),sig,current_date+14);
  exception when others then rejected:=SQLERRM='invalid_quote'; end;
  if not rejected then raise exception 'tampered total accepted'; end if;
  select starts_at into slot from public.get_available_slots_for_zone_order(p,sig,current_date+14) order by starts_at limit 1;
  if slot is null then raise exception 'no available slot'; end if;
  if exists(select 1 from public.get_available_slots_for_zone_order(p,sig,current_date+14) where
    (ends_at at time zone 'America/Argentina/Cordoba')::time>time '18:00' or ends_at-starts_at<>interval '90 minutes') then
    raise exception 'duration or close-of-day mismatch';
  end if;
  select * into b from public.create_booking_for_zone_order(p,sig,slot,'89000000-0000-4000-8000-000000000001',
    'QA Test','3510000000',null,null,gen_random_uuid(),repeat('f',64),repeat('q',64));
  update qa_quote set booking_id=b.booking_id;
  select * into duplicate from public.create_booking_for_zone_order(p,sig,slot,'89000000-0000-4000-8000-000000000001',
    'QA Test','3510000000',null,null,gen_random_uuid(),repeat('f',64),repeat('q',64));
  if b.booking_id is distinct from duplicate.booking_id then raise exception 'idempotency failed'; end if;
  if exists(select 1 from public.get_available_slots_for_zone_order(p,sig,current_date+14) s where
    tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(slot,slot+interval '90 minutes','[)')) then
    raise exception 'professional overlap still offered';
  end if;
  rejected:=false;
  begin
    perform public.create_booking_for_zone_order(p,sig,slot,'89000000-0000-4000-8000-000000000002',
      'QA Test','3510000000',null,null,gen_random_uuid(),repeat('f',64),repeat('q',64));
  exception when others then rejected:=SQLERRM='slot_not_available'; end;
  if not rejected then raise exception 'double booking accepted'; end if;
end $$;
reset role;
do $$ declare b public.bookings%rowtype; begin
  select * into b from public.bookings where id=(select booking_id from qa_quote);
  if b.professional_id<>'49000000-0000-4000-8000-000000000001' or b.applied_price_snapshot_cents<>6820000
    or b.duration_snapshot_minutes<>75 or b.buffer_snapshot_minutes<>15 or b.depilation_order_snapshot is null
    or jsonb_array_length(b.combo_extras_snapshot)<>2 then raise exception 'snapshot not persisted'; end if;
end $$;
-- The new flow must release an expired provisional hold just like the simple
-- and legacy-combo booking flows. The cleanup and all assertions roll back.
update public.bookings set created_at=now()-interval '100 days'
where id=(select booking_id from qa_quote);
set local role anon;
do $$ begin
  if not exists(
    select 1 from qa_quote q
    cross join lateral public.get_available_slots_for_zone_order(q.payload,q.signature,current_date+14)
  ) then raise exception 'expired hold still blocks availability'; end if;
end $$;
reset role;
do $$ begin
  if (select status from public.bookings where id=(select booking_id from qa_quote))<>'expired' then
    raise exception 'expired hold was not released';
  end if;
end $$;
update public.business_settings set depilation_discount_percent=20 where singleton;
set local role anon;
do $$ declare rejected boolean:=false; begin
  begin
    perform public.get_available_slots_for_zone_order(q.payload,q.signature,current_date+14) from qa_quote q;
  exception when others then rejected:=SQLERRM='quote_changed'; end;
  if not rejected then raise exception 'stale quote accepted'; end if;
end $$;

-- A combo may use its real operational duration instead of summing every zone.
reset role;
update public.treatment_combos
set appointment_duration_minutes=30
where id='79000000-0000-4000-8000-000000000001';
do $$ declare ctx jsonb; selected record; begin
  ctx:=public.get_depilation_order_context(
    '59000000-0000-4000-8000-000000000001',
    '79000000-0000-4000-8000-000000000001',
    '{}'::uuid[]
  );
  if (ctx->'combo'->>'durationMinutes')::integer<>30 then
    raise exception 'manual combo duration missing from zone-order context';
  end if;
  select * into selected from public.resolve_booking_selection_v2(
    '59000000-0000-4000-8000-000000000001',
    '79000000-0000-4000-8000-000000000001',null,'{}'::uuid[]
  );
  if selected.duration_minutes<>30 then
    raise exception 'manual combo duration missing from legacy/manual booking path';
  end if;
end $$;
reset role;
do $$ begin
  if (select applied_price_snapshot_cents from public.bookings where id=(select booking_id from qa_quote))<>6820000 then
    raise exception 'historical booking price changed';
  end if;
end $$;
rollback;
