-- Let reception recover a still-future pre-reservation after its automatic
-- pending hold expired. The operation remains role-checked, atomic and audited.

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
security definer
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
    or (selected_booking.status = 'expired' and requested_status in ('awaiting_deposit', 'confirmed'))
  ) then
    raise exception using errcode = '22023', message = 'invalid_status_transition';
  end if;

  if selected_booking.status = 'expired'
    and selected_booking.starts_at <= transition_time then
    raise exception using errcode = '22023', message = 'booking_start_passed';
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

revoke all on function public.transition_admin_booking(
  uuid,
  public.booking_status,
  text
) from public, anon;

grant execute on function public.transition_admin_booking(
  uuid,
  public.booking_status,
  text
) to authenticated;
