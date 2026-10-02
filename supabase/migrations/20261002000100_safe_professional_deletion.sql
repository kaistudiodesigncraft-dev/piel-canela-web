begin;

-- Professionals are removed only through this guarded operation. Historical
-- bookings and treatment assignments always win over permanent deletion.
revoke delete on public.professionals from authenticated;

create or replace function public.get_professional_usage_counts()
returns table (
  professional_id uuid,
  treatment_count bigint,
  booking_count bigint
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  return query
  select
    professional.id,
    coalesce(treatment_usage.total, 0),
    coalesce(booking_usage.total, 0)
  from public.professionals as professional
  left join (
    select assignment.professional_id, count(*)::bigint as total
    from public.treatment_professionals as assignment
    group by assignment.professional_id
  ) as treatment_usage on treatment_usage.professional_id = professional.id
  left join (
    select booking.professional_id, count(*)::bigint as total
    from public.bookings as booking
    where booking.professional_id is not null
    group by booking.professional_id
  ) as booking_usage on booking_usage.professional_id = professional.id;
end;
$$;

revoke all on function public.get_professional_usage_counts()
  from public, anon;
grant execute on function public.get_professional_usage_counts()
  to authenticated;

create or replace function public.delete_professional_if_unlinked(
  requested_professional_id uuid,
  request_guard_secret text
)
returns table (full_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_guard_hash text;
  selected_full_name text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  select secret_hash into stored_guard_hash
  from private.booking_guard_config
  where singleton;

  if stored_guard_hash is null
    or request_guard_secret is null
    or char_length(request_guard_secret) < 32
    or encode(extensions.digest(request_guard_secret, 'sha256'), 'hex') <> stored_guard_hash then
    raise exception using errcode = '42501', message = 'deletion_guard_invalid';
  end if;

  select professional.full_name
    into selected_full_name
  from public.professionals as professional
  where professional.id = requested_professional_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'professional_not_found';
  end if;

  if exists (
      select 1 from public.bookings
      where professional_id = requested_professional_id
    ) or exists (
      select 1 from public.treatment_professionals
      where professional_id = requested_professional_id
    ) or exists (
      select 1 from public.professional_identity_reconciliations
      where source_id = requested_professional_id or target_id = requested_professional_id
    ) then
    raise exception using errcode = '23503', message = 'professional_has_history';
  end if;

  delete from public.professionals where id = requested_professional_id;
  return query select selected_full_name;
end;
$$;

revoke all on function public.delete_professional_if_unlinked(uuid, text)
  from public, anon;
grant execute on function public.delete_professional_if_unlinked(uuid, text)
  to authenticated;

commit;
