-- Sprint 1: atomic manual bookings and integrity for reusable specialties.

create unique index if not exists specialties_name_unique_idx
  on public.specialties (lower(trim(name)));

create index if not exists bookings_status_starts_at_idx
  on public.bookings (status, starts_at);

create or replace function public.create_admin_booking(
  requested_treatment_id uuid,
  requested_monthly_special_id uuid,
  requested_starts_at timestamptz,
  requested_status public.booking_status,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text,
  customer_notes text,
  internal_notes text
)
returns table (
  booking_id uuid,
  booking_code text,
  booking_status public.booking_status
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_treatment public.treatments%rowtype;
  selected_special public.monthly_specials%rowtype;
  applied_price integer;
  new_customer_id uuid;
  new_booking public.bookings%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if requested_status not in ('pending', 'awaiting_deposit', 'confirmed') then
    raise exception using errcode = '22023', message = 'invalid_initial_status';
  end if;

  if requested_starts_at < now() - interval '15 minutes' then
    raise exception using errcode = '22023', message = 'booking_must_be_current_or_future';
  end if;

  if char_length(trim(customer_full_name)) not between 2 and 100
     or char_length(trim(customer_phone)) not between 8 and 30
     or (customer_email is not null and char_length(trim(customer_email)) > 180)
     or (customer_notes is not null and char_length(trim(customer_notes)) > 240)
     or (internal_notes is not null and char_length(trim(internal_notes)) > 1000) then
    raise exception using errcode = '22023', message = 'invalid_booking_data';
  end if;

  select * into selected_treatment
  from public.treatments
  where id = requested_treatment_id and is_active
  for share;

  if not found then
    raise exception using errcode = 'P0002', message = 'treatment_not_available';
  end if;

  applied_price := selected_treatment.price_cents;
  if requested_monthly_special_id is not null then
    select * into selected_special
    from public.monthly_specials
    where id = requested_monthly_special_id
      and treatment_id = requested_treatment_id
      and is_active
      and now() >= starts_at
      and now() < ends_at;
    if not found then
      raise exception using errcode = '22023', message = 'monthly_special_not_available';
    end if;
    applied_price := selected_special.special_price_cents;
  end if;

  insert into public.customers(full_name, phone, email)
  values (
    trim(customer_full_name),
    trim(customer_phone),
    nullif(trim(customer_email), '')
  )
  returning id into new_customer_id;

  insert into public.bookings(
    idempotency_key,
    customer_id,
    treatment_id,
    specialty_id,
    professional_id,
    monthly_special_id,
    starts_at,
    ends_at,
    duration_snapshot_minutes,
    buffer_snapshot_minutes,
    base_price_snapshot_cents,
    applied_price_snapshot_cents,
    treatment_name_snapshot,
    status,
    customer_notes,
    internal_notes,
    confirmed_at
  ) values (
    requested_idempotency_key,
    new_customer_id,
    selected_treatment.id,
    selected_treatment.specialty_id,
    selected_treatment.professional_id,
    requested_monthly_special_id,
    requested_starts_at,
    requested_starts_at + make_interval(
      mins => selected_treatment.duration_minutes + selected_treatment.buffer_minutes
    ),
    selected_treatment.duration_minutes,
    selected_treatment.buffer_minutes,
    selected_treatment.price_cents,
    applied_price,
    selected_treatment.name,
    requested_status,
    nullif(trim(customer_notes), ''),
    nullif(trim(internal_notes), ''),
    case when requested_status = 'confirmed' then now() else null end
  )
  returning * into new_booking;

  return query
    select new_booking.id, new_booking.booking_code, new_booking.status;
exception
  when exclusion_violation then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  when unique_violation then
    return query
      select booking.id, booking.booking_code, booking.status
      from public.bookings booking
      where booking.idempotency_key = requested_idempotency_key;
    if not found then
      raise;
    end if;
end;
$$;

revoke all on function public.create_admin_booking(
  uuid, uuid, timestamptz, public.booking_status, uuid,
  text, text, text, text, text
) from public, anon;
grant execute on function public.create_admin_booking(
  uuid, uuid, timestamptz, public.booking_status, uuid,
  text, text, text, text, text
) to authenticated;
