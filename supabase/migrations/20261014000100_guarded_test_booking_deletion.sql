begin;

create or replace function public.delete_booking_if_safe(
  requested_booking_id uuid,
  request_guard_secret text
)
returns table (booking_code text, customer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_guard_hash text;
  selected_booking public.bookings%rowtype;
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

  select * into selected_booking
  from public.bookings
  where id = requested_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'booking_not_found';
  end if;

  if selected_booking.status not in ('cancelled', 'expired') then
    raise exception using errcode = '22023', message = 'booking_must_be_final';
  end if;

  if selected_booking.customer_package_id is not null
    or exists (select 1 from public.customer_packages where initial_booking_id = requested_booking_id)
    or exists (select 1 from public.package_redemptions where booking_id = requested_booking_id) then
    raise exception using errcode = '23503', message = 'booking_has_package_history';
  end if;

  delete from public.whatsapp_delivery_events as event
  using public.whatsapp_outbox as outbox
  where outbox.booking_id = requested_booking_id
    and outbox.provider_message_id is not null
    and event.provider_message_id = outbox.provider_message_id;

  delete from public.whatsapp_outbox where booking_id = requested_booking_id;
  delete from public.booking_whatsapp_consents where booking_id = requested_booking_id;
  delete from public.bookings where id = requested_booking_id;

  return query select selected_booking.booking_code, selected_booking.customer_id;
end;
$$;

revoke all on function public.delete_booking_if_safe(uuid, text) from public, anon;
grant execute on function public.delete_booking_if_safe(uuid, text) to authenticated;

commit;
