\set ON_ERROR_STOP on
\echo 1..1

begin;

insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('0a000000-0000-4000-8000-000000000001','Booking status QA','booking-status-qa','Categoría aislada para validar estados.','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('0a000000-0000-4000-8000-000000000002','Booking status QA','booking-status-qa',true);
insert into public.professionals(id,specialty_id,full_name,is_active)
values('0a000000-0000-4000-8000-000000000003','0a000000-0000-4000-8000-000000000002','Booking status QA',true);
insert into public.professional_specialties(professional_id,specialty_id)
values('0a000000-0000-4000-8000-000000000003','0a000000-0000-4000-8000-000000000002');
insert into public.treatments(
  id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,price_cents,is_active
) values (
  '0a000000-0000-4000-8000-000000000004',
  '0a000000-0000-4000-8000-000000000001',
  '0a000000-0000-4000-8000-000000000002',
  '0a000000-0000-4000-8000-000000000003',
  'Booking status QA','booking-status-qa','Tratamiento aislado para estados.',
  'Tratamiento local usado solo para validar cambios auditados de estado.',
  60,0,100000,false
);
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values('0a000000-0000-4000-8000-000000000004','0a000000-0000-4000-8000-000000000003',true);
update public.treatments set is_active=true
where id='0a000000-0000-4000-8000-000000000004';
insert into public.customers(id,full_name,phone)
values
  ('0a000000-0000-4000-8000-000000000005','Cliente QA estado uno','3510000001'),
  ('0a000000-0000-4000-8000-000000000006','Cliente QA estado dos','3510000002');
insert into public.bookings(
  id,idempotency_key,customer_id,treatment_id,specialty_id,professional_id,
  starts_at,ends_at,duration_snapshot_minutes,buffer_snapshot_minutes,
  base_price_snapshot_cents,applied_price_snapshot_cents,treatment_name_snapshot,status
) values
  (
    '0a000000-0000-4000-8000-000000000007','0a000000-0000-4000-8000-000000000008',
    '0a000000-0000-4000-8000-000000000005','0a000000-0000-4000-8000-000000000004',
    '0a000000-0000-4000-8000-000000000002','0a000000-0000-4000-8000-000000000003',
    now()+interval '30 days',now()+interval '30 days 1 hour',60,0,100000,100000,
    'Booking status QA','pending'
  ),
  (
    '0a000000-0000-4000-8000-000000000009','0a000000-0000-4000-8000-00000000000a',
    '0a000000-0000-4000-8000-000000000006','0a000000-0000-4000-8000-000000000004',
    '0a000000-0000-4000-8000-000000000002','0a000000-0000-4000-8000-000000000003',
    now()+interval '31 days',now()+interval '31 days 1 hour',60,0,100000,100000,
    'Booking status QA','expired'
  );

-- Read-only backups can restore identity rows without advancing sequences.
-- Align the local-only QA sequences before exercising the audited update.
select setval(
  pg_get_serial_sequence('public.audit_log', 'id'),
  greatest(coalesce((select max(id) from public.audit_log), 0), 1),
  exists(select 1 from public.audit_log)
);
select setval(
  pg_get_serial_sequence('public.booking_status_history', 'id'),
  greatest(coalesce((select max(id) from public.booking_status_history), 0), 1),
  exists(select 1 from public.booking_status_history)
);
insert into auth.users (id, email)
values ('00000000-0000-4000-8000-0000000000aa', 'booking-status-qa@example.invalid')
on conflict (id) do nothing;

insert into public.profiles (user_id, full_name, role, is_active)
values ('00000000-0000-4000-8000-0000000000aa', 'Booking status QA', 'manager', true)
on conflict (user_id) do update
set role = excluded.role,
    is_active = excluded.is_active;

-- Reuse one restored local booking only inside this transaction. The rollback at
-- the end leaves both the booking and its audit history exactly as they were.
set local session_replication_role = replica;

update public.bookings
set status = 'pending',
    status_reason = null,
    status_changed_at = null,
    status_changed_by = null
where id = (select id from public.bookings order by created_at limit 1);

update public.bookings
set status = 'expired',
    starts_at = now() + interval '30 days',
    ends_at = now() + interval '30 days 1 hour',
    status_reason = null,
    status_changed_at = null,
    status_changed_by = null
where id = (
  select id
  from public.bookings
  order by created_at
  offset 1
  limit 1
);

set local session_replication_role = origin;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-0000000000aa',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000aa","role":"authenticated"}',
  true
);

do $$
begin
  perform *
  from public.transition_admin_booking(
    '0a000000-0000-4000-8000-000000000007',
    'awaiting_deposit'::public.booking_status,
    null
  );
  perform *
  from public.transition_admin_booking(
    '0a000000-0000-4000-8000-000000000009',
    'confirmed'::public.booking_status,
    null
  );
end;
$$;

reset role;

do $$
begin
  if (select status from public.bookings where id='0a000000-0000-4000-8000-000000000007')
      <> 'awaiting_deposit'::public.booking_status then
    raise exception 'qa_status_not_updated';
  end if;
  if (select count(*) from public.booking_status_history
      where booking_id='0a000000-0000-4000-8000-000000000007') <> 1 then
    raise exception 'qa_history_not_written';
  end if;
  if (select status from public.bookings where id='0a000000-0000-4000-8000-000000000009')
      <> 'confirmed'::public.booking_status then
    raise exception 'qa_expired_booking_not_recovered';
  end if;
  if (select count(*) from public.booking_status_history
      where booking_id='0a000000-0000-4000-8000-000000000009') <> 1 then
    raise exception 'qa_expired_history_not_written';
  end if;
end;
$$;
rollback;

-- Keep the restored local copy internally consistent after the rolled-back QA.
select setval(
  pg_get_serial_sequence('public.audit_log', 'id'),
  greatest(coalesce((select max(id) from public.audit_log), 0), 1),
  exists(select 1 from public.audit_log)
);
select setval(
  pg_get_serial_sequence('public.booking_status_history', 'id'),
  greatest(coalesce((select max(id) from public.booking_status_history), 0), 1),
  exists(select 1 from public.booking_status_history)
);

\echo ok 1 - booking status transitions are authorized and audited

