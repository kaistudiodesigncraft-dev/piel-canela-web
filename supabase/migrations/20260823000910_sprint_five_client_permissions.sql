-- Sprint 5: distinguish Kai Studio ownership from day-to-day client management.

alter table public.profiles alter column role set default 'manager';

create or replace function public.is_admin(candidate_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = candidate_user_id
      and is_active
      and role in ('admin', 'manager')
  );
$$;

create or replace function public.is_owner(candidate_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = candidate_user_id
      and is_active
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

drop policy if exists profiles_admin_or_self_read on public.profiles;
create policy profiles_owner_or_self_read on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.is_owner());

drop policy if exists admin_update_profiles on public.profiles;
create policy owner_update_profiles on public.profiles
  for update to authenticated
  using (public.is_owner())
  with check (role in ('admin', 'manager'));

grant update (full_name, is_active, role) on public.profiles to authenticated;

drop policy if exists admin_read_audit on public.audit_log;
create policy owner_read_audit on public.audit_log
  for select to authenticated using (public.is_owner());

create or replace function public.protect_admin_profile_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_owner(auth.uid()) then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;

  if new.user_id = auth.uid() and (not new.is_active or new.role <> 'admin') then
    raise exception using errcode = '22023', message = 'cannot_remove_own_owner_access';
  end if;

  if old.role = 'admin' and old.is_active
    and (new.role <> 'admin' or not new.is_active)
    and not exists (
      select 1
      from public.profiles as profile
      where profile.user_id <> old.user_id
        and profile.role = 'admin'
        and profile.is_active
    ) then
    raise exception using errcode = '22023', message = 'last_owner_required';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_admin_profile_access()
  from public, anon, authenticated;
