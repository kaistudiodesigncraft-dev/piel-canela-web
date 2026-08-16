-- Piel Canela — database foundation
-- Operational timezone: America/Argentina/Cordoba. Persisted instants use timestamptz (UTC).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.admin_role as enum ('admin');
create type public.booking_status as enum (
  'pending',
  'awaiting_deposit',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
  'expired'
);
create type public.availability_exception_kind as enum ('open', 'blocked');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  role public.admin_role not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.treatment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null default '',
  icon_name text not null check (icon_name in ('UserFocus', 'FlowerLotus', 'PersonArmsSpread')),
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Categories are commercial navigation. Specialties are operational capacity.
create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  public_name text,
  bio text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.treatment_categories(id) on delete restrict,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  professional_id uuid references public.professionals(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  short_description text not null check (char_length(trim(short_description)) between 10 and 240),
  description text not null check (char_length(trim(description)) >= 20),
  expectations text[] not null default '{}',
  characteristics text[] not null default '{}',
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 180),
  price_cents integer not null check (price_cents >= 0),
  preparation text,
  contraindications text,
  image_path text,
  image_alt text,
  image_focal_x numeric(4,3) not null default 0.5 check (image_focal_x between 0 and 1),
  image_focal_y numeric(4,3) not null default 0.5 check (image_focal_y between 0 and 1),
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_publishable check (
    not is_active or (image_path is not null and nullif(trim(image_alt), '') is not null)
  )
);

create index treatments_category_order_idx
  on public.treatments(category_id, display_order, name) where is_active;
create index treatments_specialty_idx on public.treatments(specialty_id);

create table public.monthly_specials (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 2 and 120),
  short_description text not null check (char_length(trim(short_description)) between 10 and 240),
  detail text not null check (char_length(trim(detail)) >= 20),
  image_path text not null,
  image_alt text not null check (char_length(trim(image_alt)) >= 3),
  image_focal_x numeric(4,3) not null default 0.5 check (image_focal_x between 0 and 1),
  image_focal_y numeric(4,3) not null default 0.5 check (image_focal_y between 0 and 1),
  special_price_cents integer not null check (special_price_cents > 0),
  reference_price_cents integer,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  terms text,
  is_active boolean not null default false,
  display_order integer not null default 1 check (display_order between 1 and 4),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_special_valid_period check (starts_at < ends_at),
  constraint monthly_special_valid_reference_price check (
    reference_price_cents is null or reference_price_cents > special_price_cents
  ),
  constraint monthly_special_no_treatment_overlap exclude using gist (
    treatment_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (is_active)
);

create index monthly_specials_public_idx
  on public.monthly_specials(is_active, starts_at, ends_at, display_order);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_rule_valid_period check (start_time < end_time)
);

create index availability_rules_lookup_idx
  on public.availability_rules(specialty_id, weekday) where is_active;

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties(id) on delete cascade,
  kind public.availability_exception_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  public_reason text,
  internal_reason text,
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_exception_valid_period check (starts_at < ends_at)
);

create index availability_exceptions_lookup_idx
  on public.availability_exceptions using gist (specialty_id, tstzrange(starts_at, ends_at, '[)'));

create table public.business_settings (
  singleton boolean primary key default true check (singleton),
  business_name text not null default 'Piel Canela',
  timezone text not null default 'America/Argentina/Cordoba'
    check (timezone = 'America/Argentina/Cordoba'),
  minimum_notice_minutes integer not null default 180 check (minimum_notice_minutes between 0 and 10080),
  maximum_advance_days integer not null default 45 check (maximum_advance_days between 1 and 365),
  pending_expiry_minutes integer not null default 120 check (pending_expiry_minutes between 15 and 1440),
  whatsapp_number text,
  deposit_text text,
  cancellation_policy text,
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.business_settings (singleton) values (true);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  phone text not null check (char_length(trim(phone)) between 8 and 30),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_phone_idx on public.customers(phone);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default ('PC-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8))),
  idempotency_key uuid not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  professional_id uuid references public.professionals(id) on delete set null,
  monthly_special_id uuid references public.monthly_specials(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_snapshot_minutes integer not null check (duration_snapshot_minutes between 5 and 480),
  buffer_snapshot_minutes integer not null default 0 check (buffer_snapshot_minutes between 0 and 180),
  base_price_snapshot_cents integer not null check (base_price_snapshot_cents >= 0),
  applied_price_snapshot_cents integer not null check (applied_price_snapshot_cents >= 0),
  treatment_name_snapshot text not null,
  status public.booking_status not null default 'pending',
  customer_notes text,
  internal_notes text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_valid_period check (starts_at < ends_at),
  constraint booking_specialty_capacity exclude using gist (
    specialty_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'awaiting_deposit', 'confirmed'))
);

create index bookings_agenda_idx on public.bookings(starts_at, status);
create index bookings_customer_idx on public.bookings(customer_id, starts_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin(candidate_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = candidate_user_id
      and role = 'admin'
      and is_active
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated;

create or replace function public.capture_admin_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin(auth.uid()) then
    insert into public.audit_log(actor_id, table_name, record_id, action, old_data, new_data)
    values (
      auth.uid(),
      tg_table_name,
      nullif(coalesce(to_jsonb(new), to_jsonb(old))->>'id', '')::uuid,
      lower(tg_op),
      case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
      case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
    );
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'treatment_categories', 'specialties', 'professionals', 'treatments',
    'monthly_specials', 'availability_rules', 'availability_exceptions',
    'business_settings', 'customers', 'bookings'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_updated_at', table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'treatment_categories', 'specialties', 'professionals', 'treatments',
    'monthly_specials', 'availability_rules', 'availability_exceptions',
    'business_settings', 'bookings'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.capture_admin_audit()',
      table_name || '_audit', table_name
    );
  end loop;
end;
$$;

create or replace function public.get_available_slots(
  requested_treatment_id uuid,
  requested_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
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
      (requested_date + r.start_time) at time zone c.timezone as window_start,
      (requested_date + r.end_time) at time zone c.timezone as window_end,
      r.slot_interval_minutes,
      t.specialty_id,
      t.duration_minutes + t.buffer_minutes as occupied_minutes
    from selected_treatment t
    cross join config c
    join public.availability_rules r
      on r.specialty_id = t.specialty_id
     and r.weekday = extract(dow from requested_date)::smallint
     and r.is_active
    union all
    select
      e.starts_at,
      e.ends_at,
      15,
      t.specialty_id,
      t.duration_minutes + t.buffer_minutes
    from selected_treatment t
    join public.availability_exceptions e
      on e.specialty_id = t.specialty_id
     and e.kind = 'open'
     and (e.starts_at at time zone 'America/Argentina/Cordoba')::date = requested_date
  ), candidates as (
    select
      slot_start,
      slot_start + make_interval(mins => w.occupied_minutes) as slot_end,
      w.specialty_id,
      w.window_end
    from windows w
    cross join lateral generate_series(
      w.window_start,
      w.window_end - make_interval(mins => w.occupied_minutes),
      make_interval(mins => w.slot_interval_minutes)
    ) slot_start
  )
  select distinct c.slot_start, c.slot_end
  from candidates c
  cross join config cfg
  where c.slot_end <= c.window_end
    and c.slot_start >= now() + make_interval(mins => cfg.minimum_notice_minutes)
    and requested_date <= (now() at time zone cfg.timezone)::date + cfg.maximum_advance_days
    and not exists (
      select 1 from public.availability_exceptions e
      where e.specialty_id = c.specialty_id
        and e.kind = 'blocked'
        and tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
    )
    and not exists (
      select 1 from public.bookings b
      where b.specialty_id = c.specialty_id
        and b.status in ('pending', 'awaiting_deposit', 'confirmed')
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(c.slot_start, c.slot_end, '[)')
    )
  order by c.slot_start;
$$;

revoke all on function public.get_available_slots(uuid, date) from public;
grant execute on function public.get_available_slots(uuid, date) to anon, authenticated;

create or replace function public.create_booking(
  requested_treatment_id uuid,
  requested_monthly_special_id uuid,
  requested_starts_at timestamptz,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text default null,
  customer_notes text default null
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
begin
  if char_length(trim(customer_full_name)) not between 2 and 100
     or char_length(trim(customer_phone)) not between 8 and 30 then
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
    select 1 from public.get_available_slots(requested_treatment_id, requested_local_date) s
    where s.starts_at = requested_starts_at
  ) then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  end if;

  insert into public.customers(full_name, phone, email)
  values (trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), ''))
  returning id into new_customer_id;

  insert into public.bookings(
    idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    monthly_special_id, starts_at, ends_at, duration_snapshot_minutes,
    buffer_snapshot_minutes, base_price_snapshot_cents, applied_price_snapshot_cents,
    treatment_name_snapshot, customer_notes
  ) values (
    requested_idempotency_key, new_customer_id, selected_treatment.id,
    selected_treatment.specialty_id, selected_treatment.professional_id,
    requested_monthly_special_id, requested_starts_at,
    requested_starts_at + make_interval(mins => selected_treatment.duration_minutes + selected_treatment.buffer_minutes),
    selected_treatment.duration_minutes, selected_treatment.buffer_minutes,
    selected_treatment.price_cents, applied_price, selected_treatment.name,
    nullif(trim(customer_notes), '')
  ) returning * into new_booking;

  return query select new_booking.id, new_booking.booking_code, new_booking.status;
exception
  when unique_violation then
    return query
      select b.id, b.booking_code, b.status
      from public.bookings b
      where b.idempotency_key = requested_idempotency_key;
end;
$$;

revoke all on function public.create_booking(uuid, uuid, timestamptz, uuid, text, text, text, text) from public;
grant execute on function public.create_booking(uuid, uuid, timestamptz, uuid, text, text, text, text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.treatment_categories enable row level security;
alter table public.specialties enable row level security;
alter table public.professionals enable row level security;
alter table public.treatments enable row level security;
alter table public.monthly_specials enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.business_settings enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = auth.uid());

create policy categories_public_read on public.treatment_categories for select to anon, authenticated
  using (is_active or public.is_admin());
create policy specialties_public_read on public.specialties for select to anon, authenticated
  using (is_active or public.is_admin());
create policy professionals_public_read on public.professionals for select to anon, authenticated
  using (is_active or public.is_admin());
create policy treatments_public_read on public.treatments for select to anon, authenticated
  using (is_active or public.is_admin());
create policy monthly_specials_public_read on public.monthly_specials for select to anon, authenticated
  using ((is_active and now() >= starts_at and now() < ends_at) or public.is_admin());

create policy admin_all_categories on public.treatment_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_specialties on public.specialties for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_professionals on public.professionals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_treatments on public.treatments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_monthly_specials on public.monthly_specials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_availability_rules on public.availability_rules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_availability_exceptions on public.availability_exceptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_settings on public.business_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_customers on public.customers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_all_bookings on public.bookings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy admin_read_audit on public.audit_log for select to authenticated
  using (public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.treatment_categories, public.specialties, public.professionals,
  public.treatments, public.monthly_specials to anon, authenticated;
grant select, insert, update, delete on public.treatment_categories, public.specialties,
  public.professionals, public.treatments, public.monthly_specials, public.availability_rules,
  public.availability_exceptions, public.business_settings, public.customers, public.bookings
  to authenticated;
grant select on public.profiles, public.audit_log to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'treatment-media',
  'treatment-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy treatment_media_public_read on storage.objects for select to public
  using (bucket_id = 'treatment-media');
create policy treatment_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'treatment-media' and public.is_admin());
create policy treatment_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'treatment-media' and public.is_admin())
  with check (bucket_id = 'treatment-media' and public.is_admin());
create policy treatment_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'treatment-media' and public.is_admin());

insert into public.treatment_categories(id, name, slug, short_description, icon_name, display_order)
values
  ('10000000-0000-4000-8000-000000000001', 'Estética', 'estetica', 'Tratamientos faciales y corporales para cuidar tu piel.', 'UserFocus', 1),
  ('10000000-0000-4000-8000-000000000002', 'Bienestar', 'bienestar', 'Terapias y masajes para acompañar el bienestar cotidiano.', 'FlowerLotus', 2),
  ('10000000-0000-4000-8000-000000000003', 'Recuperación', 'recuperacion', 'Prácticas profesionales para aliviar molestias y recuperar el cuerpo.', 'PersonArmsSpread', 3);

insert into public.specialties(id, name, slug, description, display_order)
values
  ('20000000-0000-4000-8000-000000000001', 'Estética facial y corporal', 'estetica-facial-corporal', 'Capacidad operativa de estética facial y corporal.', 1),
  ('20000000-0000-4000-8000-000000000002', 'Masoterapia', 'masoterapia', 'Capacidad operativa de masajes y bienestar corporal.', 2),
  ('20000000-0000-4000-8000-000000000003', 'Kinesiología', 'kinesiologia', 'Capacidad operativa de evaluación y recuperación kinésica.', 3),
  ('20000000-0000-4000-8000-000000000004', 'Nutrición', 'nutricion', 'Capacidad operativa de consultas de nutrición.', 4);
