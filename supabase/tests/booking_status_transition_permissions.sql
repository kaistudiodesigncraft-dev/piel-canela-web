\set ON_ERROR_STOP on

begin;

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
update public.bookings
set status = 'pending',
    status_reason = null,
    status_changed_at = null,
    status_changed_by = null
where id = (select id from public.bookings order by created_at limit 1);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-0000000000aa',
  true
);

do $$
declare
  target_booking_id uuid;
  history_before bigint;
  history_after bigint;
  resulting_status public.booking_status;
begin
  select id into target_booking_id
  from public.bookings
  where status = 'pending'
  order by created_at
  limit 1;

  if target_booking_id is null then
    raise exception 'qa_booking_missing';
  end if;

  select count(*) into history_before
  from public.booking_status_history
  where booking_id = target_booking_id;

  perform *
  from public.transition_admin_booking(
    target_booking_id,
    'awaiting_deposit'::public.booking_status,
    null
  );

  select status into resulting_status
  from public.bookings
  where id = target_booking_id;

  select count(*) into history_after
  from public.booking_status_history
  where booking_id = target_booking_id;

  if resulting_status <> 'awaiting_deposit'::public.booking_status then
    raise exception 'qa_status_not_updated';
  end if;

  if history_after <> history_before + 1 then
    raise exception 'qa_history_not_written';
  end if;
end;
$$;

reset role;
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

