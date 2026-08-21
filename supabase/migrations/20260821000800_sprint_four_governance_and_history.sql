-- Sprint 4: administrative governance, explicit booking history and access controls.

alter table public.bookings
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists deposit_confirmed_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists no_show_at timestamptz;

alter table public.bookings
  drop constraint if exists bookings_status_reason_length;
alter table public.bookings
  add constraint bookings_status_reason_length
  check (status_reason is null or char_length(status_reason) between 3 and 500);

create table if not exists public.booking_status_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  previous_status public.booking_status,
  next_status public.booking_status not null,
  reason text,
  actor_id uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  constraint booking_status_history_reason_length
    check (reason is null or char_length(reason) between 3 and 500)
);

create index if not exists booking_status_history_booking_created_idx
  on public.booking_status_history (booking_id, created_at desc);

alter table public.booking_status_history enable row level security;

drop policy if exists admin_read_booking_status_history on public.booking_status_history;
create policy admin_read_booking_status_history on public.booking_status_history
  for select to authenticated using (public.is_admin());

drop policy if exists admin_insert_booking_status_history on public.booking_status_history;
create policy admin_insert_booking_status_history on public.booking_status_history
  for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());

revoke all on public.booking_status_history from anon, authenticated;
grant select, insert on public.booking_status_history to authenticated;
grant usage, select on sequence public.booking_status_history_id_seq to authenticated;

insert into public.booking_status_history (
  booking_id,
  previous_status,
  next_status,
  reason,
  actor_id,
  created_at
)
select
  booking.id,
  null,
  booking.status,
  'Estado registrado al habilitar el historial operativo',
  null,
  coalesce(booking.updated_at, booking.created_at)
from public.bookings as booking
where not exists (
  select 1
  from public.booking_status_history as history
  where history.booking_id = booking.id
);

create or replace function public.transition_admin_booking(
  requested_booking_id uuid,
  requested_status public.booking_status,
  requested_reason text default null
)
returns table (
  booking_id uuid,
  previous_status public.booking_status,
  next_status public.booking_status,
  changed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_booking public.bookings%rowtype;
  normalized_reason text := nullif(trim(requested_reason), '');
  transition_time timestamptz := now();
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  select * into selected_booking
  from public.bookings
  where id = requested_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'booking_not_found';
  end if;

  if not (
    (selected_booking.status = 'pending' and requested_status in ('awaiting_deposit', 'confirmed', 'cancelled', 'expired'))
    or (selected_booking.status = 'awaiting_deposit' and requested_status in ('confirmed', 'cancelled', 'expired'))
    or (selected_booking.status = 'confirmed' and requested_status in ('completed', 'cancelled', 'no_show'))
  ) then
    raise exception using errcode = '22023', message = 'invalid_status_transition';
  end if;

  if requested_status in ('cancelled', 'no_show')
    and (normalized_reason is null or char_length(normalized_reason) < 3) then
    raise exception using errcode = '22023', message = 'status_reason_required';
  end if;

  if normalized_reason is not null and char_length(normalized_reason) > 500 then
    raise exception using errcode = '22023', message = 'status_reason_too_long';
  end if;

  update public.bookings as booking
  set status = requested_status,
      status_reason = normalized_reason,
      status_changed_at = transition_time,
      status_changed_by = auth.uid(),
      confirmed_at = case when requested_status = 'confirmed' then transition_time else booking.confirmed_at end,
      deposit_confirmed_at = case when requested_status = 'confirmed' then transition_time else booking.deposit_confirmed_at end,
      cancelled_at = case when requested_status = 'cancelled' then transition_time else booking.cancelled_at end,
      completed_at = case when requested_status = 'completed' then transition_time else booking.completed_at end,
      no_show_at = case when requested_status = 'no_show' then transition_time else booking.no_show_at end
  where booking.id = selected_booking.id;

  insert into public.booking_status_history (
    booking_id,
    previous_status,
    next_status,
    reason,
    actor_id,
    created_at
  ) values (
    selected_booking.id,
    selected_booking.status,
    requested_status,
    normalized_reason,
    auth.uid(),
    transition_time
  );

  return query select
    selected_booking.id,
    selected_booking.status,
    requested_status,
    transition_time;
end;
$$;

revoke all on function public.transition_admin_booking(uuid, public.booking_status, text)
  from public, anon;
grant execute on function public.transition_admin_booking(uuid, public.booking_status, text)
  to authenticated;

drop policy if exists profiles_self_read on public.profiles;
drop policy if exists profiles_admin_or_self_read on public.profiles;
create policy profiles_admin_or_self_read on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists admin_update_profiles on public.profiles;
create policy admin_update_profiles on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (role = 'admin');

grant update (full_name, is_active) on public.profiles to authenticated;

create or replace function public.protect_admin_profile_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if new.user_id = auth.uid() and not new.is_active then
    raise exception using errcode = '22023', message = 'cannot_disable_self';
  end if;

  perform profile.user_id
  from public.profiles as profile
  where profile.role = 'admin'
    and profile.is_active
  for update;

  if old.is_active and not new.is_active and not exists (
    select 1
    from public.profiles as profile
    where profile.user_id <> old.user_id
      and profile.role = 'admin'
      and profile.is_active
  ) then
    raise exception using errcode = '22023', message = 'last_admin_required';
  end if;

  new.role := old.role;
  return new;
end;
$$;

revoke all on function public.protect_admin_profile_access()
  from public, anon, authenticated;

drop trigger if exists profiles_protect_access on public.profiles;
create trigger profiles_protect_access
  before update of is_active, role on public.profiles
  for each row execute function public.protect_admin_profile_access();

drop trigger if exists profiles_audit on public.profiles;

create or replace function public.capture_admin_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := coalesce(to_jsonb(new), to_jsonb(old));
begin
  if public.is_admin(auth.uid()) then
    insert into public.audit_log(actor_id, table_name, record_id, action, old_data, new_data)
    values (
      auth.uid(),
      tg_table_name,
      nullif(coalesce(row_data->>'id', row_data->>'user_id'), '')::uuid,
      lower(tg_op),
      case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
    );
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_admin_audit()
  from public, anon, authenticated;

create trigger profiles_audit
  after update on public.profiles
  for each row execute function public.capture_admin_audit();
