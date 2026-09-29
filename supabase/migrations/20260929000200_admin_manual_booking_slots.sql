create or replace function public.get_admin_available_slots_for_selection(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_date date,
  requested_extra_ids uuid[] default '{}'::uuid[],
  requested_professional_id uuid default null
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected record;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  perform public.expire_pending_bookings();

  select *
  into selected
  from public.resolve_booking_selection_v2(
    requested_treatment_id,
    requested_combo_id,
    null,
    coalesce(requested_extra_ids, '{}'::uuid[])
  );

  return query
  with config as (
    select timezone, minimum_notice_minutes, maximum_advance_days
    from public.business_settings
    where singleton
  ), windows as (
    select
      (requested_date + rule.start_time) at time zone cfg.timezone as window_start,
      (requested_date + rule.end_time) at time zone cfg.timezone as window_end
    from config cfg
    join public.availability_rules rule
      on rule.specialty_id = selected.specialty_id
     and rule.weekday = extract(dow from requested_date)::smallint
     and rule.is_active
    union all
    select exception.starts_at, exception.ends_at
    from public.availability_exceptions exception
    where exception.specialty_id = selected.specialty_id
      and exception.kind = 'open'
      and (exception.starts_at at time zone 'America/Argentina/Cordoba')::date = requested_date
  ), candidates as (
    select
      slot_start,
      slot_start + make_interval(mins => selected.duration_minutes + selected.buffer_minutes) as slot_end,
      availability_window.window_end
    from windows availability_window
    cross join lateral generate_series(
      availability_window.window_start,
      availability_window.window_end - make_interval(mins => selected.duration_minutes + selected.buffer_minutes),
      make_interval(mins => selected.start_interval_minutes)
    ) slot_start
  )
  select distinct candidate.slot_start, candidate.slot_end
  from candidates candidate
  cross join config cfg
  where candidate.slot_end <= candidate.window_end
    and candidate.slot_start >= now() + make_interval(mins => cfg.minimum_notice_minutes)
    and requested_date <= (now() at time zone cfg.timezone)::date + cfg.maximum_advance_days
    and not exists (
      select 1
      from public.availability_exceptions exception
      where exception.specialty_id = selected.specialty_id
        and exception.kind = 'blocked'
        and tstzrange(exception.starts_at, exception.ends_at, '[)') && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
    and public.find_available_professional_for_booking(
      selected.treatment_id,
      candidate.slot_start,
      candidate.slot_end,
      requested_professional_id
    ) is not null
  order by candidate.slot_start;
end;
$$;

grant execute on function public.get_admin_available_slots_for_selection(uuid, uuid, date, uuid[], uuid) to authenticated;
