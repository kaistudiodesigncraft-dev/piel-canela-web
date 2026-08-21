-- Sprint 3: customer context, commercial settings and safe rescheduling.

alter table public.customers
  add column if not exists internal_notes text;

alter table public.customers
  drop constraint if exists customers_internal_notes_length;
alter table public.customers
  add constraint customers_internal_notes_length
  check (internal_notes is null or char_length(internal_notes) <= 2000);

alter table public.bookings
  add column if not exists rescheduled_at timestamptz,
  add column if not exists reschedule_count integer not null default 0;

alter table public.bookings
  drop constraint if exists bookings_reschedule_count_valid;
alter table public.bookings
  add constraint bookings_reschedule_count_valid
  check (reschedule_count between 0 and 100);

alter table public.business_settings
  add column if not exists address text,
  add column if not exists public_email text,
  add column if not exists instagram_url text;

alter table public.business_settings
  drop constraint if exists business_settings_address_length;
alter table public.business_settings
  add constraint business_settings_address_length
  check (address is null or char_length(address) <= 240);

alter table public.business_settings
  drop constraint if exists business_settings_public_email_length;
alter table public.business_settings
  add constraint business_settings_public_email_length
  check (public_email is null or char_length(public_email) <= 180);

alter table public.business_settings
  drop constraint if exists business_settings_instagram_url_length;
alter table public.business_settings
  add constraint business_settings_instagram_url_length
  check (instagram_url is null or char_length(instagram_url) <= 500);

create index if not exists customers_name_lookup_idx
  on public.customers (lower(full_name));

create index if not exists bookings_customer_upcoming_idx
  on public.bookings (customer_id, starts_at desc, status);

create or replace function public.reschedule_admin_booking(
  requested_booking_id uuid,
  requested_starts_at timestamptz
)
returns table (
  booking_id uuid,
  booking_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  reschedule_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_booking public.bookings%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if requested_starts_at < now() - interval '15 minutes' then
    raise exception using errcode = '22023', message = 'booking_must_be_current_or_future';
  end if;

  select * into selected_booking
  from public.bookings
  where id = requested_booking_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'booking_not_found';
  end if;

  if selected_booking.status not in ('pending', 'awaiting_deposit', 'confirmed') then
    raise exception using errcode = '22023', message = 'booking_cannot_be_rescheduled';
  end if;

  update public.bookings as booking
  set starts_at = requested_starts_at,
      ends_at = requested_starts_at + make_interval(
        mins => selected_booking.duration_snapshot_minutes + selected_booking.buffer_snapshot_minutes
      ),
      rescheduled_at = now(),
      reschedule_count = selected_booking.reschedule_count + 1
  where booking.id = selected_booking.id
  returning
    booking.id,
    booking.booking_code,
    booking.starts_at,
    booking.ends_at,
    booking.reschedule_count
  into selected_booking.id,
       selected_booking.booking_code,
       selected_booking.starts_at,
       selected_booking.ends_at,
       selected_booking.reschedule_count;

  return query select
    selected_booking.id,
    selected_booking.booking_code,
    selected_booking.starts_at,
    selected_booking.ends_at,
    selected_booking.reschedule_count;
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'slot_not_available';
end;
$$;

revoke all on function public.reschedule_admin_booking(uuid, timestamptz)
  from public, anon;
grant execute on function public.reschedule_admin_booking(uuid, timestamptz)
  to authenticated;

grant select (singleton, whatsapp_number, address, public_email, instagram_url)
  on public.business_settings to anon;
