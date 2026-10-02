-- Audit sprint A. Compatible function replacements; no customer data rewrites.
-- Apply before application code. Requires the existing professional/combos migrations.
begin;

create or replace function public.validate_treatment_professional_specialty()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.professional_id is null then return new; end if;
  if not exists (
    select 1 from public.professionals p where p.id = new.professional_id
      and (p.specialty_id = new.specialty_id or exists (
        select 1 from public.professional_specialties ps
        where ps.professional_id = p.id and ps.specialty_id = new.specialty_id
      ))
  ) then raise exception using errcode = '23514', message = 'professional_specialty_mismatch'; end if;
  if new.is_active and not exists (
    select 1 from public.professionals where id = new.professional_id and is_active
  ) then raise exception using errcode = '23514', message = 'inactive_professional_cannot_publish_treatment'; end if;
  return new;
end;
$$;

-- Internal variant supports excluding exactly the reservation being moved.
-- It is NOT an exposed RPC: callers cannot hide arbitrary reservations.
create or replace function private.find_booking_professional(
  treatment_id uuid, starts_at timestamptz, ends_at timestamptz,
  preferred_id uuid default null, excluded_booking_id uuid default null
)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id
  from public.treatments t
  join public.professionals p on p.is_active
    and (p.specialty_id = t.specialty_id or exists (
      select 1 from public.professional_specialties ps
      where ps.professional_id = p.id and ps.specialty_id = t.specialty_id
    ))
  left join public.treatment_professionals link
    on link.treatment_id = t.id and link.professional_id = p.id
  cross join public.business_settings cfg
  where t.id = $1 and cfg.singleton and $2 < $3
    and ($4 is null or p.id = $4)
    and (link.is_active or (
      -- Legacy fallback only if the treatment has NEVER had explicit assignments.
      not exists (select 1 from public.treatment_professionals any_link where any_link.treatment_id = t.id)
      and p.id = t.professional_id
    ))
    and not exists (
      select 1 from public.bookings b where b.professional_id = p.id
        and b.id is distinct from $5 and b.status in ('pending','awaiting_deposit','confirmed')
        and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange($2,$3,'[)')
    )
    and not exists (
      select 1 from public.professional_availability_exceptions e where e.professional_id = p.id
        and e.kind = 'blocked' and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange($2,$3,'[)')
    )
    and (
      not exists (select 1 from public.professional_availability_rules r where r.professional_id = p.id and r.is_active)
      or exists (
        select 1 from public.professional_availability_rules r
        where r.professional_id = p.id and r.is_active
          and r.weekday = extract(dow from ($2 at time zone cfg.timezone)::date)::smallint
          and $2 >= ((($2 at time zone cfg.timezone)::date + r.start_time) at time zone cfg.timezone)
          and $3 <= ((($2 at time zone cfg.timezone)::date + r.end_time) at time zone cfg.timezone)
      ) or exists (
        select 1 from public.professional_availability_exceptions e
        where e.professional_id = p.id and e.kind = 'open' and $2 >= e.starts_at and $3 <= e.ends_at
      )
    )
  order by coalesce(link.display_order,p.display_order),p.full_name,p.id limit 1;
$$;
revoke all on function private.find_booking_professional(uuid,timestamptz,timestamptz,uuid,uuid) from public,anon,authenticated;

create or replace function public.find_available_professional_for_booking(
  requested_treatment_id uuid, requested_starts_at timestamptz,
  requested_ends_at timestamptz, preferred_professional_id uuid default null
)
returns uuid language sql stable security definer set search_path = '' as $$
  select private.find_booking_professional($1,$2,$3,$4,null);
$$;

-- Shared slot generation for contracted durations (packages and rescheduling).
-- Specialty windows, notice/window, exceptions and professional eligibility all apply.
create or replace function private.get_snapshot_slots(
  treatment_id uuid, specialty_id uuid, requested_date date, occupied_minutes integer,
  interval_minutes integer, preferred_id uuid default null,
  excluded_booking_id uuid default null, expires_at timestamptz default null
)
returns table(starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with cfg as (select * from public.business_settings where singleton), windows as (
    select ($3 + r.start_time) at time zone cfg.timezone as start_at,
      ($3 + r.end_time) at time zone cfg.timezone as end_at
    from cfg join public.availability_rules r on r.specialty_id = $2
      and r.weekday = extract(dow from $3)::smallint and r.is_active
    union all
    select e.starts_at,e.ends_at from public.availability_exceptions e cross join cfg
    where e.specialty_id = $2 and e.kind = 'open'
      and e.starts_at < (($3 + 1)::timestamp at time zone cfg.timezone)
      and e.ends_at > ($3::timestamp at time zone cfg.timezone)
  ), candidates as (
    select slot_start, slot_start + make_interval(mins => $4) as slot_end
    from windows cross join lateral generate_series(start_at,
      end_at - make_interval(mins => $4),make_interval(mins => greatest($5,15))) slot_start
    where $4 > 0 and $5 in (15,30,60)
  )
  select distinct c.slot_start,c.slot_end from candidates c cross join cfg
  where (c.slot_start at time zone cfg.timezone)::date = $3
    and c.slot_start >= now() + make_interval(mins => cfg.minimum_notice_minutes)
    and $3 <= (now() at time zone cfg.timezone)::date + cfg.maximum_advance_days
    and ($8 is null or c.slot_end <= $8)
    and not exists (
      select 1 from public.availability_exceptions e where e.specialty_id = $2 and e.kind = 'blocked'
        and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(c.slot_start,c.slot_end,'[)')
    )
    and private.find_booking_professional($1,c.slot_start,c.slot_end,$6,$7) is not null
  order by c.slot_start;
$$;
revoke all on function private.get_snapshot_slots(uuid,uuid,date,integer,integer,uuid,uuid,timestamptz) from public,anon,authenticated;

create or replace function public.get_available_slots_for_reschedule(requested_booking_id uuid, requested_date date)
returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; t public.treatments%rowtype; expiry timestamptz;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into b from public.bookings where id = requested_booking_id;
  if not found or b.status not in ('pending','awaiting_deposit','confirmed') then
    raise exception using errcode = '22023', message = 'booking_cannot_be_rescheduled';
  end if;
  select * into t from public.treatments where id = b.treatment_id;
  if b.customer_package_id is not null then
    select expires_at into expiry from public.customer_packages where id = b.customer_package_id and status = 'active';
    if not found or expiry <= now() then raise exception using errcode = '22023', message = 'package_not_available'; end if;
  end if;
  return query select * from private.get_snapshot_slots(b.treatment_id,b.specialty_id,requested_date,
    b.duration_snapshot_minutes + b.buffer_snapshot_minutes,t.start_interval_minutes,b.professional_id,b.id,expiry);
end;
$$;
revoke all on function public.get_available_slots_for_reschedule(uuid,date) from public,anon;
grant execute on function public.get_available_slots_for_reschedule(uuid,date) to authenticated;

create or replace function public.reschedule_admin_booking(requested_booking_id uuid, requested_starts_at timestamptz)
returns table(booking_id uuid,booking_code text,starts_at timestamptz,ends_at timestamptz,reschedule_count integer)
language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; finish timestamptz; assigned uuid; zone text;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into b from public.bookings where id = requested_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'booking_not_found'; end if;
  if b.status not in ('pending','awaiting_deposit','confirmed') then
    raise exception using errcode = '22023', message = 'booking_cannot_be_rescheduled';
  end if;
  -- Identical replay is a no-op, including its audit count.
  if b.starts_at = requested_starts_at then
    return query select b.id,b.booking_code,b.starts_at,b.ends_at,b.reschedule_count; return;
  end if;
  select timezone into zone from public.business_settings where singleton;
  select s.ends_at into finish from public.get_available_slots_for_reschedule(b.id,
    (requested_starts_at at time zone zone)::date) s where s.starts_at = requested_starts_at;
  if finish is null then raise exception using errcode = '23P01', message = 'slot_not_available'; end if;
  assigned := private.find_booking_professional(b.treatment_id,requested_starts_at,finish,b.professional_id,b.id);
  if assigned is null then raise exception using errcode = '23P01', message = 'slot_not_available'; end if;
  update public.bookings booking set starts_at = requested_starts_at,ends_at = finish,
    professional_id = assigned,rescheduled_at = now(),reschedule_count = booking.reschedule_count + 1
    where booking.id = b.id returning booking.* into b;
  return query select b.id,b.booking_code,b.starts_at,b.ends_at,b.reschedule_count;
exception when exclusion_violation then raise exception using errcode = '23P01', message = 'slot_not_available';
end;
$$;
revoke all on function public.reschedule_admin_booking(uuid,timestamptz) from public,anon;
grant execute on function public.reschedule_admin_booking(uuid,timestamptz) to authenticated;

create or replace function public.get_available_slots_for_package(requested_package_id uuid, requested_date date)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare p public.customer_packages%rowtype; b public.bookings%rowtype; t public.treatments%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into p from public.customer_packages where id = requested_package_id and status = 'active' and expires_at > now();
  if not found then raise exception using errcode = 'P0002', message = 'package_not_available'; end if;
  select * into b from public.bookings where id = p.initial_booking_id;
  select * into t from public.treatments where id = p.treatment_id;
  -- Do not silently move a contracted package to a different specialty.
  if b.specialty_id is distinct from t.specialty_id then
    raise exception using errcode = '22023', message = 'package_specialty_changed';
  end if;
  return query select * from private.get_snapshot_slots(p.treatment_id,b.specialty_id,requested_date,
    p.duration_snapshot_minutes + p.buffer_snapshot_minutes,t.start_interval_minutes,null,null,p.expires_at);
end;
$$;
revoke all on function public.get_available_slots_for_package(uuid,date) from public,anon;
grant execute on function public.get_available_slots_for_package(uuid,date) to authenticated;
commit;
