-- Operational rollback, preserves all snapshots and customer data.
-- First set DEPILATION_ZONES_ENABLED=false and deploy the previous application.
begin;
revoke execute on function public.get_depilation_order_context(uuid,uuid,uuid[]) from anon,authenticated;
revoke execute on function public.get_available_slots_for_zone_order(text,text,date) from anon,authenticated;
revoke execute on function public.create_booking_for_zone_order(text,text,timestamptz,uuid,text,text,text,text,uuid,text,text) from anon,authenticated;
revoke update (depilation_discount_percent) on public.business_settings from authenticated;
alter policy depilation_zones_public_priced on public.depilation_zones using (true);
alter policy treatment_combos_public_priced on public.treatment_combos using (true);
-- Keep the package snapshot trigger: it preserves already-contracted orders
-- if a pending booking is confirmed after application rollback.
commit;
