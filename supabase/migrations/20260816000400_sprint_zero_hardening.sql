-- Sprint 0 hardening: signed booking requests, rate limits, pending expiry,
-- least-privilege public reads and reduced executable surface.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.booking_guard_config (
  singleton boolean primary key default true check (singleton),
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);

create table if not exists private.booking_guard_nonces (
  nonce uuid primary key,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  used_at timestamptz not null default now()
);

create table if not exists private.booking_rate_limits (
  fingerprint text primary key check (fingerprint ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts > 0),
  updated_at timestamptz not null default now()
);

revoke all on all tables in schema private from public, anon, authenticated;

create index if not exists bookings_pending_expiry_idx
  on public.bookings(status, created_at)
  where status = 'pending';

create or replace function public.expire_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  update public.bookings b
  set status = 'expired', updated_at = now()
  from public.business_settings settings
  where settings.singleton
    and b.status = 'pending'
    and b.created_at < now() - make_interval(mins => settings.pending_expiry_minutes);

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.expire_pending_bookings() from public, anon, authenticated;

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
    select id, specialty_id, duration_minutes, buffer_minutes
    from public.treatments
    where id = requested_treatment_id and is_active
  ), windows as (
    select
      (requested_date + rule.start_time) at time zone cfg.timezone as window_start,
      (requested_date + rule.end_time) at time zone cfg.timezone as window_end,
      rule.slot_interval_minutes,
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
      15,
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
      make_interval(mins => availability_window.slot_interval_minutes)
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

drop function if exists public.create_booking(
  uuid, uuid, timestamptz, uuid, text, text, text, text
);

create function public.create_booking(
  requested_treatment_id uuid,
  requested_monthly_special_id uuid,
  requested_starts_at timestamptz,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text default null,
  customer_notes text default null,
  request_guard_nonce uuid default null,
  request_guard_fingerprint text default null,
  request_guard_secret text default null
)
returns table (booking_id uuid, booking_code text, status public.booking_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_treatment public.treatments%rowtype;
  selected_special public.monthly_specials%rowtype;
  new_customer_id uuid;
  new_booking public.bookings%rowtype;
  requested_local_date date;
  applied_price integer;
  stored_guard_hash text;
  nonce_rows integer;
  attempt_count integer;
begin
  select config.secret_hash into stored_guard_hash
  from private.booking_guard_config config
  where config.singleton;

  if stored_guard_hash is null then
    raise exception using errcode = '42501', message = 'booking_guard_not_configured';
  end if;

  if request_guard_nonce is null
     or request_guard_fingerprint is null
     or request_guard_fingerprint !~ '^[a-f0-9]{64}$'
     or request_guard_secret is null
     or char_length(request_guard_secret) < 32 then
    raise exception using errcode = '42501', message = 'booking_guard_invalid';
  end if;

  if encode(extensions.digest(request_guard_secret, 'sha256'), 'hex')
     <> stored_guard_hash then
    raise exception using errcode = '42501', message = 'booking_guard_invalid';
  end if;

  delete from private.booking_guard_nonces
  where used_at < now() - interval '1 day';

  insert into private.booking_guard_nonces(nonce, fingerprint)
  values (request_guard_nonce, request_guard_fingerprint)
  on conflict do nothing;
  get diagnostics nonce_rows = row_count;
  if nonce_rows <> 1 then
    raise exception using errcode = '42501', message = 'booking_guard_replayed';
  end if;

  select * into new_booking
  from public.bookings
  where idempotency_key = requested_idempotency_key;
  if found then
    return query select new_booking.id, new_booking.booking_code, new_booking.status;
    return;
  end if;

  insert into private.booking_rate_limits as limits(
    fingerprint,
    window_started_at,
    attempts,
    updated_at
  ) values (
    request_guard_fingerprint,
    now(),
    1,
    now()
  )
  on conflict (fingerprint) do update set
    window_started_at = case
      when limits.window_started_at <= now() - interval '1 hour' then now()
      else limits.window_started_at
    end,
    attempts = case
      when limits.window_started_at <= now() - interval '1 hour' then 1
      else limits.attempts + 1
    end,
    updated_at = now()
  returning attempts into attempt_count;

  if attempt_count > 6 then
    raise exception using errcode = 'P0001', message = 'booking_rate_limited';
  end if;

  if char_length(trim(customer_full_name)) not between 2 and 100
     or char_length(trim(customer_phone)) not between 8 and 30
     or (customer_email is not null and char_length(trim(customer_email)) > 180)
     or (customer_notes is not null and char_length(trim(customer_notes)) > 240) then
    raise exception using errcode = '22023', message = 'invalid_customer_data';
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

  requested_local_date := (requested_starts_at at time zone 'America/Argentina/Cordoba')::date;
  if not exists (
    select 1
    from public.get_available_slots(requested_treatment_id, requested_local_date) slot
    where slot.starts_at = requested_starts_at
  ) then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  end if;

  insert into public.customers(full_name, phone, email)
  values (trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), ''))
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
    customer_notes
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
    nullif(trim(customer_notes), '')
  )
  returning * into new_booking;

  return query select new_booking.id, new_booking.booking_code, new_booking.status;
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

revoke all on function public.create_booking(
  uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text
) from public, authenticated;
grant execute on function public.create_booking(
  uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text
) to anon;

drop policy if exists categories_public_read on public.treatment_categories;
drop policy if exists specialties_public_read on public.specialties;
drop policy if exists professionals_public_read on public.professionals;
drop policy if exists treatments_public_read on public.treatments;
drop policy if exists monthly_specials_public_read on public.monthly_specials;

create policy categories_public_read on public.treatment_categories
  for select to anon, authenticated using (is_active);
create policy specialties_public_read on public.specialties
  for select to anon, authenticated using (is_active);
create policy professionals_public_read on public.professionals
  for select to anon, authenticated using (is_active);
create policy treatments_public_read on public.treatments
  for select to anon, authenticated using (is_active);
create policy monthly_specials_public_read on public.monthly_specials
  for select to anon, authenticated
  using (is_active and now() >= starts_at and now() < ends_at);

revoke all on public.treatment_categories, public.specialties,
  public.professionals, public.treatments, public.monthly_specials,
  public.business_settings, public.site_content from anon;

grant select (id, name, slug, short_description, icon_name, display_order, is_active)
  on public.treatment_categories to anon;
grant select (id, name, slug, description, display_order, is_active)
  on public.specialties to anon;
grant select (id, specialty_id, public_name, bio, is_active, display_order)
  on public.professionals to anon;
grant select (
  id, category_id, specialty_id, professional_id, name, slug,
  short_description, description, expectations, characteristics,
  duration_minutes, buffer_minutes, price_cents, preparation,
  contraindications, image_path, image_alt, image_focal_x, image_focal_y,
  is_active, display_order, created_at, updated_at
) on public.treatments to anon;
grant select (
  id, treatment_id, title, short_description, detail, image_path, image_alt,
  image_focal_x, image_focal_y, special_price_cents, reference_price_cents,
  starts_at, ends_at, terms, is_active, display_order, created_at, updated_at
) on public.monthly_specials to anon;
grant select (singleton, whatsapp_number)
  on public.business_settings to anon;
grant select (
  key, section, label, kind, value, image_path, image_alt, display_order, updated_at
) on public.site_content to anon;

drop policy if exists business_settings_public_read on public.business_settings;
create policy business_settings_public_read on public.business_settings
  for select to anon using (singleton);

drop function if exists public.get_public_booking_settings();

drop policy if exists treatment_media_public_read on storage.objects;
drop policy if exists site_content_media_public_read on storage.objects;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;
revoke all on function public.capture_admin_audit() from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
