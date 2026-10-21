-- Keep the zone-order calendar consistent with every other booking flow:
-- pending holds that reached their configured expiry stop occupying capacity.
-- No catalog, price, combination or booking snapshot is rewritten.
begin;

create or replace function public.get_available_slots_for_zone_order(
  payload text, signature text, requested_date date
) returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare q jsonb; t uuid; specialty uuid; occupied int; frequency int;
begin
  perform public.expire_pending_bookings();
  q:=private.verify_depilation_quote(payload,signature);
  t:=(q->'context'->>'treatmentId')::uuid;
  specialty:=(q->'context'->>'specialtyId')::uuid;
  occupied:=(q->'order'->>'durationMinutes')::int+(q->'context'->>'bufferMinutes')::int;
  frequency:=(q->'context'->>'startIntervalMinutes')::int;
  return query with cfg as (
    select b.timezone,b.minimum_notice_minutes,b.maximum_advance_days
    from public.business_settings b where singleton
  ), windows as (
    select (requested_date+r.start_time) at time zone cfg.timezone as a,
      (requested_date+r.end_time) at time zone cfg.timezone as b
      from cfg join public.availability_rules r on r.specialty_id=specialty
      and r.weekday=extract(dow from requested_date)::smallint and r.is_active
    union all select e.starts_at,e.ends_at
      from public.availability_exceptions e cross join cfg
      where e.specialty_id=specialty and e.kind='open'
      and (e.starts_at at time zone cfg.timezone)::date=requested_date
  ), candidates as (
    select s,s+make_interval(mins=>occupied) as ending from windows w
    cross join lateral generate_series(
      w.a,w.b-make_interval(mins=>occupied),make_interval(mins=>frequency)
    ) s
  )
  select distinct c.s,c.ending from candidates c cross join cfg
  where c.s>=now()+make_interval(mins=>cfg.minimum_notice_minutes)
    and requested_date<=(now() at time zone cfg.timezone)::date+cfg.maximum_advance_days
    and not exists(select 1 from public.availability_exceptions e
      where e.specialty_id=specialty and e.kind='blocked'
      and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.s,c.ending,'[)'))
    and public.find_available_professional_for_booking(t,c.s,c.ending,null) is not null
  order by c.s;
end $$;

revoke all on function public.get_available_slots_for_zone_order(text,text,date) from public;
grant execute on function public.get_available_slots_for_zone_order(text,text,date) to anon,authenticated;

commit;
