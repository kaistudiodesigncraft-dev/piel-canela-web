-- Safe operational rollback: keep the API available while disabling its write
-- side effect. Already-expired bookings remain expired, as in all other flows.
alter function public.get_available_slots_for_zone_order(text,text,date) stable;
