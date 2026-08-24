-- Weekly availability is owned by specialties. Start cadence is owned by treatments.

alter table public.treatments
  add column if not exists start_interval_minutes integer;

update public.treatments treatment
set start_interval_minutes = coalesce(
  (
    select case
      when min(rule.slot_interval_minutes) <= 15 then 15
      when min(rule.slot_interval_minutes) <= 30 then 30
      else 60
    end
    from public.availability_rules rule
    where rule.specialty_id = treatment.specialty_id
      and rule.is_active
  ),
  30
)
where treatment.start_interval_minutes is null;

alter table public.treatments
  alter column start_interval_minutes set default 30,
  alter column start_interval_minutes set not null;

alter table public.treatments
  drop constraint if exists treatments_start_interval_minutes_check;

alter table public.treatments
  add constraint treatments_start_interval_minutes_check
  check (start_interval_minutes in (15, 30, 60));

alter table public.availability_rules
  drop constraint if exists availability_rules_no_duplicates;

create unique index if not exists availability_rules_active_no_duplicates
  on public.availability_rules(specialty_id, weekday, start_time, end_time)
  where is_active;

create or replace function public.validate_active_availability_rule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.weekday not between 0 and 6 or new.start_time >= new.end_time then
    raise exception using errcode = '22023', message = 'availability_rule_invalid';
  end if;

  if new.is_active and exists (
    select 1
    from public.availability_rules existing
    where existing.specialty_id = new.specialty_id
      and existing.weekday = new.weekday
      and existing.is_active
      and existing.id <> new.id
      and existing.start_time < new.end_time
      and existing.end_time > new.start_time
  ) then
    raise exception using errcode = '23P01', message = 'availability_rule_overlap';
  end if;

  return new;
end;
$$;

drop trigger if exists availability_rules_validate_active on public.availability_rules;
create trigger availability_rules_validate_active
before insert or update of specialty_id, weekday, start_time, end_time, is_active
on public.availability_rules
for each row execute function public.validate_active_availability_rule();

revoke all on function public.validate_active_availability_rule() from public, anon, authenticated;

create or replace function public.replace_specialty_weekly_availability(
  requested_specialty_id uuid,
  requested_rules jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_rule jsonb;
  parsed_weekday smallint;
  parsed_start time;
  parsed_end time;
  inserted_count integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if requested_rules is null or jsonb_typeof(requested_rules) <> 'array' then
    raise exception using errcode = '22023', message = 'availability_week_invalid';
  end if;

  if not exists (
    select 1 from public.specialties specialty
    where specialty.id = requested_specialty_id and specialty.is_active
  ) then
    raise exception using errcode = '22023', message = 'specialty_not_available';
  end if;

  update public.availability_rules
  set is_active = false, updated_at = now()
  where specialty_id = requested_specialty_id and is_active;

  for requested_rule in select value from jsonb_array_elements(requested_rules)
  loop
    begin
      parsed_weekday := (requested_rule ->> 'weekday')::smallint;
      parsed_start := (requested_rule ->> 'start_time')::time;
      parsed_end := (requested_rule ->> 'end_time')::time;
    exception when others then
      raise exception using errcode = '22023', message = 'availability_rule_invalid';
    end;

    if parsed_weekday not between 0 and 6 or parsed_start >= parsed_end then
      raise exception using errcode = '22023', message = 'availability_rule_invalid';
    end if;

    insert into public.availability_rules(
      specialty_id,
      weekday,
      start_time,
      end_time,
      slot_interval_minutes,
      is_active
    ) values (
      requested_specialty_id,
      parsed_weekday,
      parsed_start,
      parsed_end,
      15,
      true
    );
    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.replace_specialty_weekly_availability(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_specialty_weekly_availability(uuid, jsonb)
  to authenticated;

create or replace function public.get_available_slots(
  requested_treatment_id uuid,
  requested_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.expire_pending_bookings();

  return query
  with config as (
    select timezone, minimum_notice_minutes, maximum_advance_days
    from public.business_settings
    where singleton
  ), selected_treatment as (
    select id, specialty_id, duration_minutes, buffer_minutes, start_interval_minutes
    from public.treatments
    where id = requested_treatment_id and is_active
  ), windows as (
    select
      (requested_date + rule.start_time) at time zone cfg.timezone as window_start,
      (requested_date + rule.end_time) at time zone cfg.timezone as window_end,
      treatment.start_interval_minutes,
      treatment.specialty_id,
      treatment.duration_minutes + treatment.buffer_minutes as occupied_minutes
    from selected_treatment treatment
    cross join config cfg
    join public.availability_rules rule
      on rule.specialty_id = treatment.specialty_id
     and rule.weekday = extract(dow from requested_date)::smallint
     and rule.is_active
    union all
    select
      exception.starts_at,
      exception.ends_at,
      treatment.start_interval_minutes,
      treatment.specialty_id,
      treatment.duration_minutes + treatment.buffer_minutes
    from selected_treatment treatment
    join public.availability_exceptions exception
      on exception.specialty_id = treatment.specialty_id
     and exception.kind = 'open'
     and (exception.starts_at at time zone 'America/Argentina/Cordoba')::date = requested_date
  ), candidates as (
    select
      slot_start,
      slot_start + make_interval(mins => availability_window.occupied_minutes) as slot_end,
      availability_window.specialty_id,
      availability_window.window_end
    from windows availability_window
    cross join lateral generate_series(
      availability_window.window_start,
      availability_window.window_end - make_interval(mins => availability_window.occupied_minutes),
      make_interval(mins => availability_window.start_interval_minutes)
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
      where exception.specialty_id = candidate.specialty_id
        and exception.kind = 'blocked'
        and tstzrange(exception.starts_at, exception.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
    and not exists (
      select 1
      from public.bookings booking
      where booking.specialty_id = candidate.specialty_id
        and booking.status in ('pending', 'awaiting_deposit', 'confirmed')
        and tstzrange(booking.starts_at, booking.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
  order by candidate.slot_start;
end;
$$;

revoke all on function public.get_available_slots(uuid, date) from public, authenticated;
grant execute on function public.get_available_slots(uuid, date) to anon;

grant select (
  id, category_id, specialty_id, professional_id, name, slug,
  short_description, description, expectations, characteristics,
  duration_minutes, buffer_minutes, start_interval_minutes, price_cents, preparation,
  contraindications, image_path, image_alt, image_focal_x, image_focal_y,
  is_active, display_order, created_at, updated_at
) on public.treatments to anon;
