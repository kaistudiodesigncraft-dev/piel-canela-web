begin;

create table if not exists private.admin_action_rate_limits (
  actor_id uuid not null references auth.users(id) on delete cascade,
  action_name text not null check (action_name ~ '^[a-z_]{3,64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  updated_at timestamptz not null default now(),
  primary key (actor_id, action_name)
);

revoke all on table private.admin_action_rate_limits from public, anon, authenticated;

create or replace function public.register_admin_protected_action_attempt(requested_action text)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  current_actor uuid := auth.uid();
  current_attempts integer;
begin
  if current_actor is null or not public.is_admin() then
    return false;
  end if;
  if requested_action is null or requested_action !~ '^[a-z_]{3,64}$' then
    return false;
  end if;

  insert into private.admin_action_rate_limits as rate_limit (
    actor_id, action_name, window_started_at, attempts, updated_at
  ) values (
    current_actor, requested_action, now(), 1, now()
  )
  on conflict (actor_id, action_name) do update
  set
    window_started_at = case
      when rate_limit.window_started_at <= now() - interval '1 hour' then now()
      else rate_limit.window_started_at
    end,
    attempts = case
      when rate_limit.window_started_at <= now() - interval '1 hour' then 1
      else rate_limit.attempts + 1
    end,
    updated_at = now()
  returning attempts into current_attempts;

  return current_attempts <= 5;
end;
$$;

create or replace function public.clear_admin_protected_action_attempts(requested_action text)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  if requested_action is null or requested_action !~ '^[a-z_]{3,64}$' then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  delete from private.admin_action_rate_limits
  where actor_id = auth.uid()
    and action_name = requested_action;
end;
$$;

revoke all on function public.register_admin_protected_action_attempt(text) from public, anon;
revoke all on function public.clear_admin_protected_action_attempts(text) from public, anon;
grant execute on function public.register_admin_protected_action_attempt(text) to authenticated;
grant execute on function public.clear_admin_protected_action_attempts(text) to authenticated;

commit;
