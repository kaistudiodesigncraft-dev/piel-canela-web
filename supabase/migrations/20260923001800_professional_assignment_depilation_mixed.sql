-- Professional-aware booking and mixed depilation combos.
-- Additive and preservation-first: existing treatments, professionals, bookings,
-- combos and packages are not transformed or deleted.

do $$ begin
  create type public.combo_pricing_mode as enum ('fixed_price', 'percentage_discount', 'tiered_discount');
exception when duplicate_object then null;
end $$;

alter table public.treatments
  drop constraint if exists treatments_selection_mode_check;

alter table public.treatments
  add constraint treatments_selection_mode_check
  check (selection_mode in ('simple', 'closed_combo', 'combo_with_extras'));

alter table public.treatments
  add column if not exists requires_professional_assignment boolean not null default true;

alter table public.professionals
  add column if not exists phone text check (phone is null or char_length(trim(phone)) between 6 and 40),
  add column if not exists internal_notes text check (internal_notes is null or char_length(trim(internal_notes)) <= 1400);

create table if not exists public.professional_specialties (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (professional_id, specialty_id)
);

create table if not exists public.treatment_professionals (
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (treatment_id, professional_id)
);

create index if not exists treatment_professionals_professional_idx
  on public.treatment_professionals (professional_id, is_active);

insert into public.professional_specialties(professional_id, specialty_id)
select id, specialty_id from public.professionals
on conflict do nothing;

insert into public.treatment_professionals(treatment_id, professional_id, is_active)
select treatment.id, treatment.professional_id, true
from public.treatments treatment
where treatment.professional_id is not null
on conflict do nothing;

create table if not exists public.professional_availability_rules (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_availability_valid_period check (start_time < end_time)
);

create table if not exists public.professional_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  kind public.availability_exception_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_availability_exception_valid_period check (starts_at < ends_at)
);

create index if not exists professional_availability_rules_lookup_idx
  on public.professional_availability_rules (professional_id, weekday, is_active);
create index if not exists professional_availability_exceptions_lookup_idx
  on public.professional_availability_exceptions using gist (professional_id, tstzrange(starts_at, ends_at, '[)'));

alter table public.treatment_combos
  add column if not exists pricing_mode public.combo_pricing_mode not null default 'fixed_price',
  add column if not exists discount_percent numeric(5,2) check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)),
  add column if not exists tier_min_items integer check (tier_min_items is null or tier_min_items between 1 and 99),
  add column if not exists tier_discount_percent numeric(5,2) check (tier_discount_percent is null or (tier_discount_percent >= 0 and tier_discount_percent <= 100)),
  add column if not exists allow_public_extras boolean not null default false;

create table if not exists public.treatment_combo_extras (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text not null default '' check (char_length(trim(description)) <= 500),
  audience public.depilation_audience not null default 'shared',
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 0 and 240),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists treatment_combo_extras_unique_idx
  on public.treatment_combo_extras (treatment_id, lower(trim(name)));

create table if not exists public.treatment_combo_allowed_extras (
  combo_id uuid not null references public.treatment_combos(id) on delete cascade,
  extra_id uuid not null references public.treatment_combo_extras(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (combo_id, extra_id)
);

alter table public.bookings
  add column if not exists combo_extras_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists combo_pricing_mode_snapshot public.combo_pricing_mode,
  add column if not exists combo_discount_snapshot jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.bookings drop constraint if exists booking_specialty_capacity;
exception when undefined_object then null;
end $$;

do $$ begin
  alter table public.bookings drop constraint if exists booking_professional_capacity;
  drop index if exists public.booking_professional_capacity;
  alter table public.bookings
    add constraint booking_professional_capacity exclude using gist (
      professional_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (professional_id is not null and status in ('pending', 'awaiting_deposit', 'confirmed'));
exception
  when duplicate_object or duplicate_table then null;
end $$;

drop trigger if exists treatment_professionals_updated_at on public.treatment_professionals;
drop trigger if exists professional_availability_rules_updated_at on public.professional_availability_rules;
drop trigger if exists professional_availability_exceptions_updated_at on public.professional_availability_exceptions;
drop trigger if exists treatment_combo_extras_updated_at on public.treatment_combo_extras;

create trigger treatment_professionals_updated_at before update on public.treatment_professionals
  for each row execute function public.set_updated_at();
create trigger professional_availability_rules_updated_at before update on public.professional_availability_rules
  for each row execute function public.set_updated_at();
create trigger professional_availability_exceptions_updated_at before update on public.professional_availability_exceptions
  for each row execute function public.set_updated_at();
create trigger treatment_combo_extras_updated_at before update on public.treatment_combo_extras
  for each row execute function public.set_updated_at();

alter table public.professional_specialties enable row level security;
alter table public.treatment_professionals enable row level security;
alter table public.professional_availability_rules enable row level security;
alter table public.professional_availability_exceptions enable row level security;
alter table public.treatment_combo_extras enable row level security;
alter table public.treatment_combo_allowed_extras enable row level security;

drop policy if exists professional_specialties_admin_all on public.professional_specialties;
drop policy if exists treatment_professionals_admin_all on public.treatment_professionals;
drop policy if exists professional_availability_rules_admin_all on public.professional_availability_rules;
drop policy if exists professional_availability_exceptions_admin_all on public.professional_availability_exceptions;
drop policy if exists treatment_combo_extras_admin_all on public.treatment_combo_extras;
drop policy if exists treatment_combo_allowed_extras_admin_all on public.treatment_combo_allowed_extras;
drop policy if exists treatment_professionals_public_read on public.treatment_professionals;
drop policy if exists treatment_combo_extras_public_read on public.treatment_combo_extras;
drop policy if exists treatment_combo_allowed_extras_public_read on public.treatment_combo_allowed_extras;

create policy professional_specialties_admin_all on public.professional_specialties for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatment_professionals_admin_all on public.treatment_professionals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy professional_availability_rules_admin_all on public.professional_availability_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy professional_availability_exceptions_admin_all on public.professional_availability_exceptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatment_combo_extras_admin_all on public.treatment_combo_extras for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatment_combo_allowed_extras_admin_all on public.treatment_combo_allowed_extras for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy treatment_professionals_public_read on public.treatment_professionals for select to anon
  using (is_active);
create policy treatment_combo_extras_public_read on public.treatment_combo_extras for select to anon
  using (is_active);
create policy treatment_combo_allowed_extras_public_read on public.treatment_combo_allowed_extras for select to anon
  using (true);

create or replace function public.save_treatment_professional_assignments(
  requested_treatment_id uuid,
  requested_professional_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  professional_id uuid;
  display_index integer := 0;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  perform 1 from public.treatments where id = requested_treatment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'treatment_not_found'; end if;

  update public.treatment_professionals set is_active = false where treatment_id = requested_treatment_id;
  foreach professional_id in array coalesce(requested_professional_ids, '{}'::uuid[])
  loop
    if not exists (select 1 from public.professionals where id = professional_id and is_active) then
      raise exception using errcode = '22023', message = 'professional_not_available';
    end if;
    insert into public.treatment_professionals(treatment_id, professional_id, is_active, display_order)
    values(requested_treatment_id, professional_id, true, display_index)
    on conflict (treatment_id, professional_id) do update set
      is_active = true,
      display_order = excluded.display_order,
      updated_at = now();
    display_index := display_index + 1;
  end loop;
end;
$$;

grant execute on function public.save_treatment_professional_assignments(uuid, uuid[]) to authenticated;

create or replace function public.find_available_professional_for_booking(
  requested_treatment_id uuid,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  preferred_professional_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assigned_professional uuid;
begin
  select candidate.id into assigned_professional
  from (
    select professional.id, coalesce(link.display_order, professional.display_order, 0) as sort_order, professional.full_name
    from public.treatments treatment
    join public.treatment_professionals link on link.treatment_id = treatment.id and link.is_active
    join public.professionals professional on professional.id = link.professional_id and professional.is_active
    where treatment.id = requested_treatment_id
    union
    select professional.id, professional.display_order, professional.full_name
    from public.treatments treatment
    join public.professionals professional on professional.id = treatment.professional_id and professional.is_active
    where treatment.id = requested_treatment_id
    union
    select professional.id, professional.display_order, professional.full_name
    from public.treatments treatment
    join public.professional_specialties ps on ps.specialty_id = treatment.specialty_id
    join public.professionals professional on professional.id = ps.professional_id and professional.is_active
    where treatment.id = requested_treatment_id
  ) candidate
  where (preferred_professional_id is null or candidate.id = preferred_professional_id)
    and not exists (
      select 1 from public.bookings booking
      where booking.professional_id = candidate.id
        and booking.status in ('pending', 'awaiting_deposit', 'confirmed')
        and tstzrange(booking.starts_at, booking.ends_at, '[)') && tstzrange(requested_starts_at, requested_ends_at, '[)')
    )
    and not exists (
      select 1 from public.professional_availability_exceptions exception
      where exception.professional_id = candidate.id and exception.kind = 'blocked'
        and tstzrange(exception.starts_at, exception.ends_at, '[)') && tstzrange(requested_starts_at, requested_ends_at, '[)')
    )
  order by candidate.sort_order, candidate.full_name
  limit 1;

  return assigned_professional;
end;
$$;

grant execute on function public.find_available_professional_for_booking(uuid, timestamptz, timestamptz, uuid) to anon, authenticated;

create or replace function public.auto_assign_professional_for_booking(
  requested_treatment_id uuid,
  requested_starts_at timestamptz,
  requested_ends_at timestamptz,
  preferred_professional_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  assigned_professional uuid;
begin
  assigned_professional := public.find_available_professional_for_booking(
    requested_treatment_id,
    requested_starts_at,
    requested_ends_at,
    preferred_professional_id
  );
  if assigned_professional is null then
    raise exception using errcode = '23P01', message = 'professional_not_available';
  end if;
  return assigned_professional;
end;
$$;

grant execute on function public.auto_assign_professional_for_booking(uuid, timestamptz, timestamptz, uuid) to anon, authenticated;

create or replace function public.save_treatment_combo(
  requested_combo_id uuid,
  requested_treatment_id uuid,
  requested_name text,
  requested_description text,
  requested_audience public.depilation_audience,
  requested_mode public.combo_mode,
  requested_session_count integer,
  requested_fixed_price_cents integer,
  requested_validity_days integer,
  requested_display_order integer,
  requested_is_active boolean,
  requested_zone_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_combo_id uuid := coalesce(requested_combo_id, extensions.gen_random_uuid());
  zone_value jsonb;
  zone_id uuid;
  zone_order integer := 0;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if jsonb_typeof(requested_zone_ids) <> 'array' or jsonb_array_length(requested_zone_ids) = 0 then
    raise exception using errcode = '22023', message = 'combo_requires_zone';
  end if;
  if not exists (
    select 1 from public.treatments
    where id = requested_treatment_id and selection_mode in ('closed_combo', 'combo_with_extras')
  ) then raise exception using errcode = '22023', message = 'combo_requires_configurable_treatment'; end if;
  if requested_combo_id is not null and exists (
    select 1 from public.treatment_combos combo
    where combo.id = requested_combo_id and combo.treatment_id <> requested_treatment_id
  ) then raise exception using errcode = '22023', message = 'combo_treatment_mismatch'; end if;

  insert into public.treatment_combos(
    id, treatment_id, name, description, audience, mode, session_count,
    fixed_price_cents, validity_days, display_order, is_active
  ) values (
    selected_combo_id, requested_treatment_id, trim(requested_name), trim(coalesce(requested_description, '')),
    requested_audience, requested_mode, requested_session_count, requested_fixed_price_cents,
    requested_validity_days, requested_display_order, false
  )
  on conflict (id) do update set
    name = excluded.name, description = excluded.description, audience = excluded.audience,
    mode = excluded.mode, session_count = excluded.session_count,
    fixed_price_cents = excluded.fixed_price_cents, validity_days = excluded.validity_days,
    display_order = excluded.display_order, is_active = false;

  delete from public.treatment_combo_zones link where link.combo_id = selected_combo_id;
  for zone_value in select value from jsonb_array_elements(requested_zone_ids)
  loop
    zone_id := trim(both '"' from zone_value::text)::uuid;
    if not exists (
      select 1 from public.depilation_zones zone
      where zone.id = zone_id and zone.is_active
        and (zone.audience = 'shared' or zone.audience = requested_audience)
    ) then
      raise exception using errcode = '22023', message = 'combo_zone_not_available';
    end if;
    insert into public.treatment_combo_zones(combo_id, zone_id, display_order)
    values (selected_combo_id, zone_id, zone_order);
    zone_order := zone_order + 1;
  end loop;

  if requested_is_active then
    update public.treatment_combos set is_active = true where id = selected_combo_id;
  end if;
  return selected_combo_id;
end;
$$;

grant execute on function public.save_treatment_combo(
  uuid, uuid, text, text, public.depilation_audience, public.combo_mode,
  integer, integer, integer, integer, boolean, jsonb
) to authenticated;

create or replace function public.validate_treatment_combo_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active and not exists (
    select 1 from public.treatment_combo_zones link
    join public.depilation_zones zone on zone.id = link.zone_id and zone.is_active
    where link.combo_id = new.id
  ) then
    raise exception using errcode = '23514', message = 'published_combo_requires_active_zone';
  end if;
  if not exists (
    select 1 from public.treatments treatment
    where treatment.id = new.treatment_id and treatment.selection_mode in ('closed_combo', 'combo_with_extras')
  ) then
    raise exception using errcode = '23514', message = 'combo_requires_configurable_treatment';
  end if;
  return new;
end;
$$;

create or replace function public.validate_treatment_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.is_active then return new; end if;
  if new.selection_mode = 'simple' and new.price_cents <= 0 then
    raise exception using errcode = '23514', message = 'published_treatment_requires_positive_price';
  end if;
  if new.selection_mode = 'simple' and exists (
    select 1 from public.treatment_combos combo
    where combo.treatment_id = new.id and combo.is_active
  ) then
    raise exception using errcode = '23514', message = 'simple_treatment_cannot_keep_active_combos';
  end if;
  if new.selection_mode = 'simple' and exists (
    select 1 from public.monthly_specials special
    where special.treatment_id = new.id
      and special.is_active
      and special.pricing_mode <> 'special_price'
  ) then
    raise exception using errcode = '23514', message = 'simple_special_requires_price';
  end if;
  if nullif(trim(coalesce(new.image_path, '')), '') is not null
    and char_length(trim(coalesce(new.image_alt, ''))) < 3 then
    raise exception using errcode = '23514', message = 'treatment_image_requires_accessible_description';
  end if;
  if not exists (select 1 from public.treatment_categories where id = new.category_id and is_active) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_category';
  end if;
  if not exists (select 1 from public.specialties where id = new.specialty_id and is_active) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_specialty';
  end if;
  if new.requires_professional_assignment and not exists (
    select 1 from public.treatment_professionals link
    join public.professionals professional on professional.id = link.professional_id and professional.is_active
    where link.treatment_id = new.id and link.is_active
  ) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_professional';
  end if;
  if new.selection_mode in ('closed_combo', 'combo_with_extras') and not exists (
    select 1 from public.treatment_combos combo
    where combo.treatment_id = new.id and combo.is_active
  ) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_combo';
  end if;
  if new.selection_mode in ('closed_combo', 'combo_with_extras') and not exists (
    select 1 from public.business_settings settings
    where settings.singleton and settings.depilation_combos_enabled
  ) then
    raise exception using errcode = '23514', message = 'published_combo_treatment_requires_feature_enabled';
  end if;
  if new.selection_mode in ('closed_combo', 'combo_with_extras') and exists (
    select 1 from public.monthly_specials special
    where special.treatment_id = new.id
      and special.is_active
      and special.pricing_mode <> 'combo_catalog'
  ) then
    raise exception using errcode = '23514', message = 'closed_combo_special_requires_marketing_mode';
  end if;
  return new;
end;
$$;

grant execute on function public.validate_treatment_publication() to authenticated;

create or replace function public.validate_monthly_special_pricing_mode()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare treatment_mode text;
begin
  select selection_mode into treatment_mode
  from public.treatments where id = new.treatment_id;
  if treatment_mode is null then
    raise exception using errcode = '23503', message = 'special_treatment_not_found';
  end if;
  if treatment_mode = 'simple' and new.pricing_mode <> 'special_price' then
    raise exception using errcode = '23514', message = 'simple_special_requires_price';
  end if;
  if treatment_mode in ('closed_combo', 'combo_with_extras') and new.pricing_mode <> 'combo_catalog' then
    raise exception using errcode = '23514', message = 'combo_special_is_marketing_only';
  end if;
  return new;
end;
$$;

create or replace function public.resolve_booking_selection_v2(
  requested_treatment_id uuid,
  requested_combo_id uuid default null,
  requested_monthly_special_id uuid default null,
  requested_extra_ids uuid[] default '{}'::uuid[]
)
returns table (
  treatment_id uuid,
  specialty_id uuid,
  professional_id uuid,
  selection_mode text,
  treatment_name text,
  combo_id uuid,
  combo_name text,
  combo_mode public.combo_mode,
  combo_audience public.depilation_audience,
  zones jsonb,
  extras jsonb,
  pricing_mode public.combo_pricing_mode,
  discount jsonb,
  duration_minutes integer,
  buffer_minutes integer,
  start_interval_minutes integer,
  base_price_cents integer,
  applied_price_cents integer,
  session_count integer,
  validity_days integer,
  price_per_session_cents integer,
  savings_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected record;
  extra_snapshot jsonb := '[]'::jsonb;
  extra_duration integer := 0;
  extra_total integer := 0;
  item_count integer := 0;
  computed_price integer;
  discount_payload jsonb := '{}'::jsonb;
begin
  select * into selected from public.resolve_booking_selection(requested_treatment_id, requested_combo_id, requested_monthly_special_id);

  if requested_combo_id is null then
    if coalesce(array_length(requested_extra_ids, 1), 0) > 0 then
      raise exception using errcode = '22023', message = 'extras_require_combo';
    end if;
    return query select
      selected.treatment_id, selected.specialty_id, selected.professional_id, selected.selection_mode,
      selected.treatment_name, selected.combo_id, selected.combo_name, selected.combo_mode,
      selected.combo_audience, selected.zones, '[]'::jsonb, null::public.combo_pricing_mode,
      '{}'::jsonb, selected.duration_minutes, selected.buffer_minutes,
      selected.start_interval_minutes, selected.base_price_cents, selected.applied_price_cents,
      selected.session_count, selected.validity_days, selected.price_per_session_cents, selected.savings_cents;
    return;
  end if;

  if coalesce(array_length(requested_extra_ids, 1), 0) > 0 then
    if not exists (select 1 from public.treatment_combos combo where combo.id = requested_combo_id and combo.allow_public_extras) then
      raise exception using errcode = '22023', message = 'combo_extras_not_allowed';
    end if;

    select
      coalesce(jsonb_agg(jsonb_build_object(
        'id', extra.id,
        'name', extra.name,
        'audience', extra.audience,
        'priceCents', extra.price_cents,
        'durationMinutes', extra.duration_minutes
      ) order by extra.display_order, extra.name), '[]'::jsonb),
      coalesce(sum(extra.duration_minutes), 0)::integer,
      coalesce(sum(extra.price_cents), 0)::integer
    into extra_snapshot, extra_duration, extra_total
    from public.treatment_combo_extras extra
    join public.treatment_combo_allowed_extras allowed on allowed.extra_id = extra.id and allowed.combo_id = requested_combo_id
    where extra.id = any(requested_extra_ids)
      and extra.treatment_id = requested_treatment_id
      and extra.is_active
      and (extra.audience = 'shared' or extra.audience = selected.combo_audience);

    if jsonb_array_length(extra_snapshot) <> coalesce(array_length(requested_extra_ids, 1), 0) then
      raise exception using errcode = '22023', message = 'combo_extra_not_available';
    end if;
  end if;

  extra_total := extra_total * selected.session_count;

  item_count := jsonb_array_length(selected.zones) + jsonb_array_length(extra_snapshot);
  select case combo.pricing_mode
    when 'percentage_discount' then round((selected.base_price_cents + extra_total) * (1 - coalesce(combo.discount_percent, 0) / 100.0))::integer
    when 'tiered_discount' then
      case when item_count >= coalesce(combo.tier_min_items, 999)
        then round((selected.base_price_cents + extra_total) * (1 - coalesce(combo.tier_discount_percent, 0) / 100.0))::integer
        else selected.base_price_cents + extra_total end
    else selected.applied_price_cents + extra_total
  end,
  jsonb_build_object(
    'pricingMode', combo.pricing_mode,
    'discountPercent', combo.discount_percent,
    'tierMinItems', combo.tier_min_items,
    'tierDiscountPercent', combo.tier_discount_percent,
    'allowPublicExtras', combo.allow_public_extras
  )
  into computed_price, discount_payload
  from public.treatment_combos combo
  where combo.id = requested_combo_id;

  computed_price := greatest(0, computed_price);

  return query select
    selected.treatment_id, selected.specialty_id, selected.professional_id, selected.selection_mode,
    selected.treatment_name, selected.combo_id, selected.combo_name, selected.combo_mode,
    selected.combo_audience, selected.zones, extra_snapshot,
    (discount_payload->>'pricingMode')::public.combo_pricing_mode, discount_payload,
    selected.duration_minutes + extra_duration, selected.buffer_minutes,
    selected.start_interval_minutes, selected.base_price_cents + extra_total,
    computed_price, selected.session_count, selected.validity_days,
    round(computed_price::numeric / selected.session_count)::integer,
    greatest(0, selected.base_price_cents + extra_total - computed_price);
end;
$$;

grant execute on function public.resolve_booking_selection_v2(uuid, uuid, uuid, uuid[]) to anon;

create or replace function public.get_available_slots_for_selection_v2(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_date date,
  requested_extra_ids uuid[] default '{}'::uuid[]
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  selected record;
begin
  perform public.expire_pending_bookings();
  select * into selected from public.resolve_booking_selection_v2(requested_treatment_id, requested_combo_id, null, requested_extra_ids);

  return query
  with config as (
    select timezone, minimum_notice_minutes, maximum_advance_days from public.business_settings where singleton
  ), windows as (
    select
      (requested_date + rule.start_time) at time zone cfg.timezone as window_start,
      (requested_date + rule.end_time) at time zone cfg.timezone as window_end
    from config cfg
    join public.availability_rules rule on rule.specialty_id = selected.specialty_id
      and rule.weekday = extract(dow from requested_date)::smallint and rule.is_active
    union all
    select exception.starts_at, exception.ends_at
    from public.availability_exceptions exception
    where exception.specialty_id = selected.specialty_id
      and exception.kind = 'open'
      and (exception.starts_at at time zone 'America/Argentina/Cordoba')::date = requested_date
  ), candidates as (
    select slot_start,
      slot_start + make_interval(mins => selected.duration_minutes + selected.buffer_minutes) as slot_end,
      availability_window.window_end
    from windows availability_window
    cross join lateral generate_series(
      availability_window.window_start,
      availability_window.window_end - make_interval(mins => selected.duration_minutes + selected.buffer_minutes),
      make_interval(mins => selected.start_interval_minutes)
    ) slot_start
  )
  select distinct candidate.slot_start, candidate.slot_end
  from candidates candidate cross join config cfg
  where candidate.slot_end <= candidate.window_end
    and candidate.slot_start >= now() + make_interval(mins => cfg.minimum_notice_minutes)
    and requested_date <= (now() at time zone cfg.timezone)::date + cfg.maximum_advance_days
    and not exists (
      select 1 from public.availability_exceptions exception
      where exception.specialty_id = selected.specialty_id and exception.kind = 'blocked'
        and tstzrange(exception.starts_at, exception.ends_at, '[)') && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
    and public.find_available_professional_for_booking(
        selected.treatment_id, candidate.slot_start, candidate.slot_end, null
      ) is not null
  order by candidate.slot_start;
end;
$$;

grant execute on function public.get_available_slots_for_selection_v2(uuid, uuid, date, uuid[]) to anon;

create or replace function public.create_booking_for_selection_v2(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_monthly_special_id uuid,
  requested_starts_at timestamptz,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text default null,
  customer_notes text default null,
  request_guard_nonce uuid default null,
  request_guard_fingerprint text default null,
  request_guard_secret text default null,
  requested_extra_ids uuid[] default '{}'::uuid[],
  requested_professional_id uuid default null
)
returns table (booking_id uuid, booking_code text, status public.booking_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected record;
  new_customer_id uuid;
  new_booking public.bookings%rowtype;
  requested_local_date date;
  assigned_professional uuid;
  starts_end timestamptz;
  stored_guard_hash text;
  nonce_rows integer;
  attempt_count integer;
begin
  select config.secret_hash into stored_guard_hash from private.booking_guard_config config where config.singleton;
  if stored_guard_hash is null then raise exception using errcode = '42501', message = 'booking_guard_not_configured'; end if;
  if request_guard_nonce is null or request_guard_fingerprint !~ '^[a-f0-9]{64}$'
    or request_guard_secret is null or char_length(request_guard_secret) < 32
    or encode(extensions.digest(request_guard_secret, 'sha256'), 'hex') <> stored_guard_hash then
    raise exception using errcode = '42501', message = 'booking_guard_invalid';
  end if;
  delete from private.booking_guard_nonces where used_at < now() - interval '1 day';
  insert into private.booking_guard_nonces(nonce, fingerprint) values (request_guard_nonce, request_guard_fingerprint) on conflict do nothing;
  get diagnostics nonce_rows = row_count;
  if nonce_rows <> 1 then raise exception using errcode = '42501', message = 'booking_guard_replayed'; end if;

  select * into new_booking from public.bookings where idempotency_key = requested_idempotency_key;
  if found then return query select new_booking.id, new_booking.booking_code, new_booking.status; return; end if;

  insert into private.booking_rate_limits as limits(fingerprint, window_started_at, attempts, updated_at)
  values (request_guard_fingerprint, now(), 1, now())
  on conflict (fingerprint) do update set
    window_started_at = case when limits.window_started_at <= now() - interval '1 hour' then now() else limits.window_started_at end,
    attempts = case when limits.window_started_at <= now() - interval '1 hour' then 1 else limits.attempts + 1 end,
    updated_at = now()
  returning attempts into attempt_count;
  if attempt_count > 6 then raise exception using errcode = 'P0001', message = 'booking_rate_limited'; end if;

  if char_length(trim(customer_full_name)) not between 2 and 100
    or char_length(trim(customer_phone)) not between 8 and 30
    or (customer_email is not null and char_length(trim(customer_email)) > 180)
    or (customer_notes is not null and char_length(trim(customer_notes)) > 240) then
    raise exception using errcode = '22023', message = 'invalid_customer_data';
  end if;

  select * into selected
  from public.resolve_booking_selection_v2(requested_treatment_id, requested_combo_id, requested_monthly_special_id, requested_extra_ids);
  starts_end := requested_starts_at + make_interval(mins => selected.duration_minutes + selected.buffer_minutes);
  assigned_professional := public.auto_assign_professional_for_booking(selected.treatment_id, requested_starts_at, starts_end, requested_professional_id);

  requested_local_date := (requested_starts_at at time zone 'America/Argentina/Cordoba')::date;
  if not exists (
    select 1 from public.get_available_slots_for_selection_v2(
      requested_treatment_id, requested_combo_id, requested_local_date, requested_extra_ids
    ) slot where slot.starts_at = requested_starts_at
  ) then raise exception using errcode = '23P01', message = 'slot_not_available'; end if;

  insert into public.customers(full_name, phone, email)
  values (trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), ''))
  returning id into new_customer_id;

  insert into public.bookings(
    idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    monthly_special_id, treatment_combo_id, starts_at, ends_at,
    duration_snapshot_minutes, buffer_snapshot_minutes, base_price_snapshot_cents,
    applied_price_snapshot_cents, treatment_name_snapshot, customer_notes,
    combo_name_snapshot, combo_mode_snapshot, combo_audience_snapshot, combo_zones_snapshot,
    combo_extras_snapshot, combo_pricing_mode_snapshot, combo_discount_snapshot,
    combo_session_count_snapshot, combo_validity_days_snapshot, combo_reference_price_snapshot_cents,
    combo_price_per_session_snapshot_cents, combo_savings_snapshot_cents,
    package_charge_kind
  ) values (
    requested_idempotency_key, new_customer_id, selected.treatment_id, selected.specialty_id, assigned_professional,
    requested_monthly_special_id, selected.combo_id, requested_starts_at, starts_end,
    selected.duration_minutes, selected.buffer_minutes, selected.base_price_cents,
    selected.applied_price_cents, selected.treatment_name, nullif(trim(customer_notes), ''),
    selected.combo_name, selected.combo_mode, selected.combo_audience, selected.zones,
    selected.extras, selected.pricing_mode, selected.discount,
    selected.session_count, selected.validity_days, selected.base_price_cents,
    selected.price_per_session_cents, selected.savings_cents,
    case when selected.combo_mode = 'package' then 'package_initial' else 'standard' end
  ) returning * into new_booking;

  return query select new_booking.id, new_booking.booking_code, new_booking.status;
exception
  when exclusion_violation then raise exception using errcode = '23P01', message = 'slot_not_available';
  when unique_violation then
    return query select booking.id, booking.booking_code, booking.status
    from public.bookings booking where booking.idempotency_key = requested_idempotency_key;
    if not found then raise; end if;
end;
$$;

grant execute on function public.create_booking_for_selection_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text, uuid[], uuid
) to anon;

create or replace function public.create_booking_with_communication_v2(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_monthly_special_id uuid,
  requested_starts_at timestamptz,
  requested_idempotency_key uuid,
  customer_full_name text,
  customer_phone text,
  customer_email text default null,
  customer_notes text default null,
  request_guard_nonce uuid default null,
  request_guard_fingerprint text default null,
  request_guard_secret text default null,
  requested_whatsapp_opt_in boolean default false,
  requested_extra_ids uuid[] default '{}'::uuid[],
  requested_professional_id uuid default null
)
returns table(booking_id uuid, booking_code text, status public.booking_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  result record;
  already_created boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(requested_idempotency_key::text, 916));
  select exists(select 1 from public.bookings where idempotency_key = requested_idempotency_key) into already_created;
  select * into result from public.create_booking_for_selection_v2(
    requested_treatment_id, requested_combo_id, requested_monthly_special_id,
    requested_starts_at, requested_idempotency_key, customer_full_name, customer_phone,
    customer_email, customer_notes, request_guard_nonce, request_guard_fingerprint,
    request_guard_secret, requested_extra_ids, requested_professional_id
  );
  if requested_whatsapp_opt_in and not already_created and result.booking_id is not null then
    if regexp_replace(customer_phone,'[ +().-]','','g') !~ '^[1-9][0-9]{7,14}$' then
      raise exception 'invalid_whatsapp_phone' using errcode='22023';
    end if;
    insert into public.booking_whatsapp_consents(booking_id) values(result.booking_id) on conflict do nothing;
    insert into public.whatsapp_outbox(booking_id,event,booking_starts_at)
    select booking.id,'pre_reservation',booking.starts_at from public.bookings booking where booking.id=result.booking_id on conflict do nothing;
  end if;
  return query select result.booking_id, result.booking_code, result.status;
end;
$$;

grant execute on function public.create_booking_with_communication_v2(
  uuid, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text, boolean, uuid[], uuid
) to anon;

create or replace function public.save_depilation_combo_v2(
  requested_combo_id uuid,
  requested_treatment_id uuid,
  requested_name text,
  requested_description text,
  requested_audience public.depilation_audience,
  requested_mode public.combo_mode,
  requested_session_count integer,
  requested_fixed_price_cents integer,
  requested_validity_days integer,
  requested_display_order integer,
  requested_is_active boolean,
  requested_zone_ids jsonb,
  requested_pricing_mode public.combo_pricing_mode,
  requested_discount_percent numeric,
  requested_tier_min_items integer,
  requested_tier_discount_percent numeric,
  requested_allow_public_extras boolean,
  requested_extra_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_combo_id uuid;
  extra_value jsonb;
  extra_id uuid;
begin
  saved_combo_id := public.save_treatment_combo(
    requested_combo_id, requested_treatment_id, requested_name, requested_description,
    requested_audience, requested_mode, requested_session_count, requested_fixed_price_cents,
    requested_validity_days, requested_display_order, false, requested_zone_ids
  );

  update public.treatment_combos set
    pricing_mode = requested_pricing_mode,
    discount_percent = case when requested_pricing_mode = 'percentage_discount' then requested_discount_percent else null end,
    tier_min_items = case when requested_pricing_mode = 'tiered_discount' then requested_tier_min_items else null end,
    tier_discount_percent = case when requested_pricing_mode = 'tiered_discount' then requested_tier_discount_percent else null end,
    allow_public_extras = requested_allow_public_extras,
    is_active = false
  where id = saved_combo_id;

  delete from public.treatment_combo_allowed_extras where combo_id = saved_combo_id;
  if requested_allow_public_extras and jsonb_typeof(requested_extra_ids) = 'array' then
    for extra_value in select value from jsonb_array_elements(requested_extra_ids)
    loop
      extra_id := trim(both '"' from extra_value::text)::uuid;
      if not exists (
        select 1 from public.treatment_combo_extras extra
        where extra.id = extra_id and extra.treatment_id = requested_treatment_id and extra.is_active
          and (extra.audience = 'shared' or extra.audience = requested_audience)
      ) then raise exception using errcode = '22023', message = 'combo_extra_not_available'; end if;
      insert into public.treatment_combo_allowed_extras(combo_id, extra_id) values(saved_combo_id, extra_id);
    end loop;
  end if;

  if requested_is_active then
    update public.treatment_combos set is_active = true where id = saved_combo_id;
  end if;
  return saved_combo_id;
end;
$$;

grant execute on function public.save_depilation_combo_v2(
  uuid, uuid, text, text, public.depilation_audience, public.combo_mode,
  integer, integer, integer, integer, boolean, jsonb,
  public.combo_pricing_mode, numeric, integer, numeric, boolean, jsonb
) to authenticated;
