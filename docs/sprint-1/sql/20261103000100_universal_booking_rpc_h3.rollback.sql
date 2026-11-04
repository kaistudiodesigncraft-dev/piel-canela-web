-- LOCAL rollback rehearsal for H3. Do not run after creating real v2 bookings.
begin;

drop function if exists public.create_booking_for_booking_order_v2(
  text, text, timestamptz, uuid, text, text, text, text, uuid, text, text
);
drop function if exists public.get_available_dates_for_booking_order_v2(text, text, date, date);
drop function if exists public.get_available_slots_for_booking_order_v2(text, text, date);
drop function if exists private.verify_booking_order_quote_v2(text, text);
drop function if exists public.get_booking_order_context_v2(uuid, uuid, uuid[]);

drop index if exists public.bookings_treatment_option_combo_idx;
alter table public.bookings
  drop constraint if exists bookings_order_v2_combo_snapshot,
  drop constraint if exists bookings_order_v2_snapshot_shape,
  drop column if exists booking_order_v2_snapshot,
  drop column if exists treatment_option_combo_id;

commit;
