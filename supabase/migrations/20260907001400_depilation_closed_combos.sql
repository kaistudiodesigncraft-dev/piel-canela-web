-- Depilation closed combos and session packages.
-- Additive by design: every existing treatment remains `simple` and every
-- existing booking keeps its original snapshots and behavior.

create type public.depilation_audience as enum ('women', 'men', 'shared');
create type public.combo_mode as enum ('single_session', 'package');
create type public.customer_package_status as enum ('active', 'completed', 'expired', 'cancelled');

alter table public.treatments
  add column selection_mode text not null default 'simple'
  check (selection_mode in ('simple', 'closed_combo'));

alter table public.business_settings
  add column depilation_combos_enabled boolean not null default false;

alter table public.monthly_specials
  add column pricing_mode text not null default 'special_price'
  check (pricing_mode in ('special_price', 'combo_catalog'));

alter table public.monthly_specials
  drop constraint if exists monthly_specials_special_price_cents_check,
  drop constraint if exists monthly_special_valid_reference_price;

alter table public.monthly_specials
  add constraint monthly_special_price_mode_consistency check (
    (pricing_mode = 'special_price' and special_price_cents > 0
      and (reference_price_cents is null or reference_price_cents > special_price_cents))
    or (pricing_mode = 'combo_catalog' and special_price_cents = 0 and reference_price_cents is null)
  );

create table public.depilation_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  audience public.depilation_audience not null default 'shared',
  reference_price_cents integer not null check (reference_price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 240),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index depilation_zones_name_unique_idx
  on public.depilation_zones (lower(trim(name)));
create index depilation_zones_public_idx
  on public.depilation_zones (audience, display_order, name) where is_active;

create table public.treatment_combos (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text not null default '' check (char_length(trim(description)) <= 500),
  audience public.depilation_audience not null default 'shared',
  mode public.combo_mode not null default 'single_session',
  session_count integer not null default 1 check (session_count between 1 and 48),
  fixed_price_cents integer not null check (fixed_price_cents > 0),
  validity_days integer check (validity_days between 1 and 730),
  is_active boolean not null default false,
  display_order integer not null default 0 check (display_order between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_combo_mode_consistency check (
    (mode = 'single_session' and session_count = 1 and validity_days is null)
    or (mode = 'package' and session_count > 1 and validity_days is not null)
  )
);

create unique index treatment_combos_name_unique_idx
  on public.treatment_combos (treatment_id, lower(trim(name)));
create index treatment_combos_public_idx
  on public.treatment_combos (treatment_id, audience, display_order, name) where is_active;

create table public.treatment_combo_zones (
  combo_id uuid not null references public.treatment_combos(id) on delete cascade,
  zone_id uuid not null references public.depilation_zones(id) on delete restrict,
  display_order integer not null default 0 check (display_order between 0 and 999),
  created_at timestamptz not null default now(),
  primary key (combo_id, zone_id)
);

alter table public.bookings
  add column treatment_combo_id uuid references public.treatment_combos(id) on delete restrict,
  add column combo_name_snapshot text,
  add column combo_mode_snapshot public.combo_mode,
  add column combo_audience_snapshot public.depilation_audience,
  add column combo_zones_snapshot jsonb not null default '[]'::jsonb,
  add column combo_session_count_snapshot integer not null default 1 check (combo_session_count_snapshot between 1 and 48),
  add column combo_validity_days_snapshot integer,
  add column combo_reference_price_snapshot_cents integer,
  add column combo_price_per_session_snapshot_cents integer,
  add column combo_savings_snapshot_cents integer,
  add column package_charge_kind text not null default 'standard'
    check (package_charge_kind in ('standard', 'package_initial', 'package_included'));

alter table public.bookings
  add constraint bookings_combo_special_exclusive check (
    treatment_combo_id is null or monthly_special_id is null
  );

create table public.customer_packages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  combo_id uuid not null references public.treatment_combos(id) on delete restrict,
  initial_booking_id uuid not null unique references public.bookings(id) on delete restrict,
  combo_name_snapshot text not null,
  zones_snapshot jsonb not null,
  total_sessions integer not null check (total_sessions between 2 and 48),
  duration_snapshot_minutes integer not null check (duration_snapshot_minutes between 5 and 480),
  buffer_snapshot_minutes integer not null check (buffer_snapshot_minutes between 0 and 180),
  fixed_price_snapshot_cents integer not null check (fixed_price_snapshot_cents > 0),
  price_per_session_snapshot_cents integer not null check (price_per_session_snapshot_cents > 0),
  savings_snapshot_cents integer not null default 0 check (savings_snapshot_cents >= 0),
  validity_days_snapshot integer not null check (validity_days_snapshot between 1 and 730),
  activated_at timestamptz not null,
  expires_at timestamptz not null,
  status public.customer_package_status not null default 'active',
  status_reason text check (status_reason is null or char_length(trim(status_reason)) between 3 and 500),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_package_valid_period check (activated_at < expires_at)
);

alter table public.bookings
  add column customer_package_id uuid references public.customer_packages(id) on delete restrict;

create index customer_packages_customer_idx
  on public.customer_packages (customer_id, status, expires_at);
create index bookings_customer_package_idx
  on public.bookings (customer_package_id, starts_at);

create table public.package_redemptions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.customer_packages(id) on delete restrict,
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  consumed_at timestamptz,
  restored_at timestamptz,
  decided_by uuid not null references public.profiles(user_id) on delete restrict,
  reason text not null check (char_length(trim(reason)) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint package_redemption_valid_state check (
    consumed_at is not null or restored_at is not null
  )
);

create index package_redemptions_package_idx
  on public.package_redemptions (package_id, consumed_at, restored_at);

create trigger depilation_zones_updated_at before update on public.depilation_zones
  for each row execute function public.set_updated_at();
create trigger treatment_combos_updated_at before update on public.treatment_combos
  for each row execute function public.set_updated_at();
create trigger customer_packages_updated_at before update on public.customer_packages
  for each row execute function public.set_updated_at();
create trigger package_redemptions_updated_at before update on public.package_redemptions
  for each row execute function public.set_updated_at();

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
  if treatment_mode = 'closed_combo' and new.pricing_mode <> 'combo_catalog' then
    raise exception using errcode = '23514', message = 'combo_special_is_marketing_only';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_monthly_special_pricing_mode() from public, anon, authenticated;
create trigger monthly_specials_validate_pricing_mode
before insert or update of treatment_id, pricing_mode, special_price_cents, reference_price_cents
on public.monthly_specials for each row execute function public.validate_monthly_special_pricing_mode();

create or replace function public.validate_depilation_zone_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_active and exists (
    select 1
    from public.treatment_combo_zones link
    join public.treatment_combos combo on combo.id = link.combo_id
    where link.zone_id = new.id and combo.is_active
  ) then
    raise exception using errcode = '23503', message = 'zone_used_by_active_combo';
  end if;
  if new.audience <> 'shared' and exists (
    select 1
    from public.treatment_combo_zones link
    join public.treatment_combos combo on combo.id = link.combo_id
    where link.zone_id = new.id and combo.audience <> new.audience
  ) then
    raise exception using errcode = '23514', message = 'zone_audience_conflict';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_depilation_zone_update() from public, anon, authenticated;
create trigger depilation_zones_validate_links
before update of audience, is_active on public.depilation_zones
for each row execute function public.validate_depilation_zone_update();

create trigger depilation_zones_audit after insert or update or delete on public.depilation_zones
  for each row execute function public.capture_admin_audit();
create trigger treatment_combos_audit after insert or update or delete on public.treatment_combos
  for each row execute function public.capture_admin_audit();
create trigger customer_packages_audit after insert or update or delete on public.customer_packages
  for each row execute function public.capture_admin_audit();
create trigger package_redemptions_audit after insert or update or delete on public.package_redemptions
  for each row execute function public.capture_admin_audit();

alter table public.depilation_zones enable row level security;
alter table public.treatment_combos enable row level security;
alter table public.treatment_combo_zones enable row level security;
alter table public.customer_packages enable row level security;
alter table public.package_redemptions enable row level security;

create policy depilation_zones_public_read on public.depilation_zones
  for select to anon using (
    is_active and exists (
      select 1 from public.business_settings settings
      where settings.singleton and settings.depilation_combos_enabled
    )
  );
create policy treatment_combos_public_read on public.treatment_combos
  for select to anon using (
    is_active and exists (
      select 1 from public.treatments treatment
      cross join public.business_settings settings
      where treatment.id = treatment_id
        and treatment.is_active
        and treatment.selection_mode = 'closed_combo'
        and settings.singleton
        and settings.depilation_combos_enabled
    )
  );
create policy treatment_combo_zones_public_read on public.treatment_combo_zones
  for select to anon using (
    exists (
      select 1 from public.treatment_combos combo
      cross join public.business_settings settings
      where combo.id = combo_id and combo.is_active
        and settings.singleton and settings.depilation_combos_enabled
    )
    and exists (select 1 from public.depilation_zones zone where zone.id = zone_id and zone.is_active)
  );

create policy depilation_zones_admin_all on public.depilation_zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatment_combos_admin_all on public.treatment_combos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy treatment_combo_zones_admin_all on public.treatment_combo_zones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy customer_packages_admin_all on public.customer_packages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy package_redemptions_admin_all on public.package_redemptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.depilation_zones, public.treatment_combos, public.treatment_combo_zones,
  public.customer_packages, public.package_redemptions from anon, authenticated;
grant select on public.depilation_zones, public.treatment_combos, public.treatment_combo_zones to anon;
grant select, insert, update on public.depilation_zones to authenticated;
grant select on public.treatment_combos, public.treatment_combo_zones,
  public.customer_packages, public.package_redemptions to authenticated;

grant select (selection_mode) on public.treatments to anon;
grant select (pricing_mode) on public.monthly_specials to anon;
grant select (depilation_combos_enabled) on public.business_settings to anon, authenticated;
grant update (depilation_combos_enabled) on public.business_settings to authenticated;

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
    where id = requested_treatment_id and selection_mode = 'closed_combo'
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

revoke all on function public.save_treatment_combo(
  uuid, uuid, text, text, public.depilation_audience, public.combo_mode,
  integer, integer, integer, integer, boolean, jsonb
) from public, anon;
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
    where treatment.id = new.treatment_id and treatment.selection_mode = 'closed_combo'
  ) then
    raise exception using errcode = '23514', message = 'combo_requires_configurable_treatment';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_treatment_combo_publication() from public, anon, authenticated;
create trigger treatment_combos_validate_publication
before insert or update of is_active, treatment_id on public.treatment_combos
for each row execute function public.validate_treatment_combo_publication();

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
  if new.selection_mode = 'closed_combo' and not exists (
    select 1 from public.treatment_combos combo
    where combo.treatment_id = new.id and combo.is_active
  ) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_combo';
  end if;
  if new.selection_mode = 'closed_combo' and not exists (
    select 1 from public.business_settings settings
    where settings.singleton and settings.depilation_combos_enabled
  ) then
    raise exception using errcode = '23514', message = 'published_combo_treatment_requires_feature_enabled';
  end if;
  if new.selection_mode = 'closed_combo' and exists (
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

revoke all on function public.validate_treatment_publication() from public, anon;
grant execute on function public.validate_treatment_publication() to authenticated;

drop trigger if exists treatments_validate_publication on public.treatments;
create trigger treatments_validate_publication
before insert or update of is_active, category_id, specialty_id, price_cents, image_path, image_alt, selection_mode
on public.treatments for each row execute function public.validate_treatment_publication();

create or replace function public.validate_depilation_feature_toggle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.depilation_combos_enabled and not new.depilation_combos_enabled
    and exists (
      select 1 from public.treatments treatment
      where treatment.is_active and treatment.selection_mode = 'closed_combo'
    ) then
    raise exception using errcode = '23514', message = 'deactivate_combo_treatments_before_disabling_feature';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_depilation_feature_toggle() from public, anon, authenticated;
create trigger business_settings_validate_depilation_feature
before update of depilation_combos_enabled on public.business_settings
for each row execute function public.validate_depilation_feature_toggle();

create or replace function public.resolve_booking_selection(
  requested_treatment_id uuid,
  requested_combo_id uuid default null,
  requested_monthly_special_id uuid default null
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
  selected_treatment public.treatments%rowtype;
  selected_combo public.treatment_combos%rowtype;
  selected_special public.monthly_specials%rowtype;
  zone_snapshot jsonb;
  zone_duration integer;
  reference_total integer;
  combos_enabled boolean;
begin
  select * into selected_treatment
  from public.treatments
  where id = requested_treatment_id and is_active;
  if not found then
    raise exception using errcode = 'P0002', message = 'treatment_not_available';
  end if;

  if selected_treatment.selection_mode = 'simple' then
    if requested_combo_id is not null then
      raise exception using errcode = '22023', message = 'combo_not_allowed';
    end if;
    if requested_monthly_special_id is not null then
      select * into selected_special from public.monthly_specials
      where id = requested_monthly_special_id
        and treatment_id = requested_treatment_id
        and is_active and now() >= starts_at and now() < ends_at;
      if not found then
        raise exception using errcode = '22023', message = 'monthly_special_not_available';
      end if;
    end if;
    return query select
      selected_treatment.id, selected_treatment.specialty_id, selected_treatment.professional_id,
      selected_treatment.selection_mode, selected_treatment.name,
      null::uuid, null::text, null::public.combo_mode, null::public.depilation_audience,
      '[]'::jsonb, selected_treatment.duration_minutes, selected_treatment.buffer_minutes,
      selected_treatment.start_interval_minutes, selected_treatment.price_cents,
      coalesce(selected_special.special_price_cents, selected_treatment.price_cents),
      1, null::integer, coalesce(selected_special.special_price_cents, selected_treatment.price_cents),
      greatest(0, selected_treatment.price_cents - coalesce(selected_special.special_price_cents, selected_treatment.price_cents));
    return;
  end if;

  select depilation_combos_enabled into combos_enabled
  from public.business_settings where singleton;
  if not coalesce(combos_enabled, false) then
    raise exception using errcode = '22023', message = 'closed_combos_disabled';
  end if;
  if requested_monthly_special_id is not null then
    raise exception using errcode = '22023', message = 'combo_special_conflict';
  end if;
  if requested_combo_id is null then
    raise exception using errcode = '22023', message = 'combo_required';
  end if;

  select * into selected_combo from public.treatment_combos
  where id = requested_combo_id and treatment_id = requested_treatment_id and is_active;
  if not found then
    raise exception using errcode = 'P0002', message = 'combo_not_available';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', zone.id,
      'name', zone.name,
      'audience', zone.audience,
      'referencePriceCents', zone.reference_price_cents,
      'durationMinutes', zone.duration_minutes
    ) order by link.display_order, zone.display_order, zone.name), '[]'::jsonb),
    coalesce(sum(zone.duration_minutes), 0)::integer,
    coalesce(sum(zone.reference_price_cents), 0)::integer * selected_combo.session_count
  into zone_snapshot, zone_duration, reference_total
  from public.treatment_combo_zones link
  join public.depilation_zones zone on zone.id = link.zone_id and zone.is_active
  where link.combo_id = selected_combo.id;

  if zone_duration <= 0 then
    raise exception using errcode = '22023', message = 'combo_has_no_active_zones';
  end if;

  return query select
    selected_treatment.id, selected_treatment.specialty_id, selected_treatment.professional_id,
    selected_treatment.selection_mode, selected_treatment.name,
    selected_combo.id, selected_combo.name, selected_combo.mode, selected_combo.audience,
    zone_snapshot, zone_duration, selected_treatment.buffer_minutes,
    selected_treatment.start_interval_minutes, reference_total, selected_combo.fixed_price_cents,
    selected_combo.session_count, selected_combo.validity_days,
    round(selected_combo.fixed_price_cents::numeric / selected_combo.session_count)::integer,
    greatest(0, reference_total - selected_combo.fixed_price_cents);
end;
$$;

revoke all on function public.resolve_booking_selection(uuid, uuid, uuid) from public, authenticated;
grant execute on function public.resolve_booking_selection(uuid, uuid, uuid) to anon;

create or replace function public.get_available_slots_for_selection(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_date date
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
  select * into selected
  from public.resolve_booking_selection(requested_treatment_id, requested_combo_id, null);

  return query
  with config as (
    select timezone, minimum_notice_minutes, maximum_advance_days
    from public.business_settings where singleton
  ), windows as (
    select
      (requested_date + rule.start_time) at time zone cfg.timezone as window_start,
      (requested_date + rule.end_time) at time zone cfg.timezone as window_end
    from config cfg
    join public.availability_rules rule
      on rule.specialty_id = selected.specialty_id
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
      window.window_end
    from windows window
    cross join lateral generate_series(
      window.window_start,
      window.window_end - make_interval(mins => selected.duration_minutes + selected.buffer_minutes),
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
    and not exists (
      select 1 from public.bookings booking
      where booking.specialty_id = selected.specialty_id
        and booking.status in ('pending', 'awaiting_deposit', 'confirmed')
        and tstzrange(booking.starts_at, booking.ends_at, '[)') && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
  order by candidate.slot_start;
end;
$$;

revoke all on function public.get_available_slots_for_selection(uuid, uuid, date) from public, authenticated;
grant execute on function public.get_available_slots_for_selection(uuid, uuid, date) to anon;

create or replace function public.create_booking_for_selection(
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
  request_guard_secret text default null
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
  insert into private.booking_guard_nonces(nonce, fingerprint)
  values (request_guard_nonce, request_guard_fingerprint) on conflict do nothing;
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
  from public.resolve_booking_selection(requested_treatment_id, requested_combo_id, requested_monthly_special_id);
  requested_local_date := (requested_starts_at at time zone 'America/Argentina/Cordoba')::date;
  if requested_combo_id is null then
    if not exists (select 1 from public.get_available_slots(requested_treatment_id, requested_local_date) slot where slot.starts_at = requested_starts_at) then
      raise exception using errcode = '23P01', message = 'slot_not_available';
    end if;
  elsif not exists (
    select 1 from public.get_available_slots_for_selection(requested_treatment_id, requested_combo_id, requested_local_date) slot
    where slot.starts_at = requested_starts_at
  ) then
    raise exception using errcode = '23P01', message = 'slot_not_available';
  end if;

  insert into public.customers(full_name, phone, email)
  values (trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), ''))
  returning id into new_customer_id;

  insert into public.bookings(
    idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    monthly_special_id, treatment_combo_id, starts_at, ends_at,
    duration_snapshot_minutes, buffer_snapshot_minutes, base_price_snapshot_cents,
    applied_price_snapshot_cents, treatment_name_snapshot, customer_notes,
    combo_name_snapshot, combo_mode_snapshot, combo_audience_snapshot, combo_zones_snapshot,
    combo_session_count_snapshot, combo_validity_days_snapshot, combo_reference_price_snapshot_cents,
    combo_price_per_session_snapshot_cents, combo_savings_snapshot_cents,
    package_charge_kind
  ) values (
    requested_idempotency_key, new_customer_id, selected.treatment_id, selected.specialty_id, selected.professional_id,
    requested_monthly_special_id, selected.combo_id, requested_starts_at,
    requested_starts_at + make_interval(mins => selected.duration_minutes + selected.buffer_minutes),
    selected.duration_minutes, selected.buffer_minutes, selected.base_price_cents,
    selected.applied_price_cents, selected.treatment_name, nullif(trim(customer_notes), ''),
    selected.combo_name, selected.combo_mode, selected.combo_audience, selected.zones,
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

revoke all on function public.create_booking_for_selection(
  uuid, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text
) from public, authenticated;
grant execute on function public.create_booking_for_selection(
  uuid, uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text
) to anon;

create or replace function public.create_admin_booking_for_selection(
  requested_treatment_id uuid,
  requested_combo_id uuid,
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
returns table (booking_id uuid, booking_code text, booking_status public.booking_status)
language plpgsql
security definer
set search_path = ''
as $$
declare selected record; new_customer_id uuid; new_booking public.bookings%rowtype; requested_local_date date;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if requested_status not in ('pending','awaiting_deposit','confirmed') then
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
  select * into new_booking from public.bookings where idempotency_key = requested_idempotency_key;
  if found then return query select new_booking.id, new_booking.booking_code, new_booking.status; return; end if;
  select * into selected from public.resolve_booking_selection(requested_treatment_id, requested_combo_id, requested_monthly_special_id);
  requested_local_date := (requested_starts_at at time zone 'America/Argentina/Cordoba')::date;
  if requested_combo_id is null then
    if not exists (
      select 1 from public.get_available_slots(requested_treatment_id, requested_local_date) slot
      where slot.starts_at = requested_starts_at
    ) then raise exception using errcode = '23P01', message = 'slot_not_available'; end if;
  elsif not exists (
    select 1 from public.get_available_slots_for_selection(
      requested_treatment_id, requested_combo_id, requested_local_date
    ) slot where slot.starts_at = requested_starts_at
  ) then raise exception using errcode = '23P01', message = 'slot_not_available'; end if;
  insert into public.customers(full_name, phone, email)
  values (trim(customer_full_name), trim(customer_phone), nullif(trim(customer_email), '')) returning id into new_customer_id;
  insert into public.bookings(
    idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    monthly_special_id, treatment_combo_id, starts_at, ends_at,
    duration_snapshot_minutes, buffer_snapshot_minutes, base_price_snapshot_cents,
    applied_price_snapshot_cents, treatment_name_snapshot, customer_notes, internal_notes,
    combo_name_snapshot, combo_mode_snapshot, combo_audience_snapshot, combo_zones_snapshot,
    combo_session_count_snapshot, combo_validity_days_snapshot, combo_reference_price_snapshot_cents,
    combo_price_per_session_snapshot_cents, combo_savings_snapshot_cents,
    package_charge_kind, status, confirmed_at, deposit_confirmed_at, status_changed_at, status_changed_by
  ) values (
    requested_idempotency_key, new_customer_id, selected.treatment_id, selected.specialty_id, selected.professional_id,
    requested_monthly_special_id, selected.combo_id, requested_starts_at,
    requested_starts_at + make_interval(mins => selected.duration_minutes + selected.buffer_minutes),
    selected.duration_minutes, selected.buffer_minutes, selected.base_price_cents,
    selected.applied_price_cents, selected.treatment_name, nullif(trim(customer_notes), ''), nullif(trim(internal_notes), ''),
    selected.combo_name, selected.combo_mode, selected.combo_audience, selected.zones,
    selected.session_count, selected.validity_days, selected.base_price_cents,
    selected.price_per_session_cents, selected.savings_cents,
    case when selected.combo_mode = 'package' then 'package_initial' else 'standard' end,
    requested_status, case when requested_status = 'confirmed' then now() end,
    case when requested_status = 'confirmed' then now() end, now(), auth.uid()
  ) returning * into new_booking;
  insert into public.booking_status_history(booking_id, previous_status, next_status, reason, actor_id)
  values (new_booking.id, null, requested_status, 'Turno asignado manualmente', auth.uid());
  return query select new_booking.id, new_booking.booking_code, new_booking.status;
exception
  when exclusion_violation then raise exception using errcode = '23P01', message = 'slot_not_available';
  when unique_violation then
    return query select booking.id, booking.booking_code, booking.status from public.bookings booking
    where booking.idempotency_key = requested_idempotency_key;
    if not found then raise; end if;
end;
$$;

revoke all on function public.create_admin_booking_for_selection(
  uuid, uuid, uuid, timestamptz, public.booking_status, uuid, text, text, text, text, text
) from public, anon;
grant execute on function public.create_admin_booking_for_selection(
  uuid, uuid, uuid, timestamptz, public.booking_status, uuid, text, text, text, text, text
) to authenticated;

create or replace function public.activate_package_from_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activated_time timestamptz;
  package_id uuid;
begin
  if new.status <> 'confirmed' or new.package_charge_kind <> 'package_initial'
    or new.customer_package_id is not null or new.combo_mode_snapshot is distinct from 'package'
    or new.combo_session_count_snapshot <= 1 then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' then return new; end if;

  activated_time := coalesce(new.deposit_confirmed_at, new.confirmed_at, now());
  insert into public.customer_packages(
    customer_id, treatment_id, combo_id, initial_booking_id, combo_name_snapshot,
    zones_snapshot, total_sessions, duration_snapshot_minutes, buffer_snapshot_minutes,
    fixed_price_snapshot_cents, price_per_session_snapshot_cents, savings_snapshot_cents,
    validity_days_snapshot, activated_at, expires_at,
    status, created_by
  ) values (
    new.customer_id, new.treatment_id, new.treatment_combo_id, new.id, new.combo_name_snapshot,
    new.combo_zones_snapshot, new.combo_session_count_snapshot, new.duration_snapshot_minutes,
    new.buffer_snapshot_minutes, new.applied_price_snapshot_cents,
    new.combo_price_per_session_snapshot_cents, new.combo_savings_snapshot_cents,
    new.combo_validity_days_snapshot, activated_time,
    activated_time + make_interval(days => new.combo_validity_days_snapshot),
    'active', new.status_changed_by
  ) on conflict (initial_booking_id) do nothing
  returning id into package_id;

  if package_id is null then
    select id into package_id
    from public.customer_packages
    where initial_booking_id = new.id;
  end if;

  if new.customer_package_id is distinct from package_id then
    update public.bookings set customer_package_id = package_id where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.activate_package_from_booking() from public, anon, authenticated;
create trigger bookings_activate_package
after insert or update of status on public.bookings
for each row execute function public.activate_package_from_booking();

create or replace function public.set_package_session_consumption(
  requested_booking_id uuid,
  requested_consume boolean,
  requested_reason text
)
returns table (package_id uuid, consumed_sessions integer, remaining_sessions integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_booking public.bookings%rowtype;
  selected_package public.customer_packages%rowtype;
  normalized_reason text := nullif(trim(requested_reason), '');
  consumed_count integer;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if normalized_reason is null or char_length(normalized_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'redemption_reason_required';
  end if;
  select * into selected_booking from public.bookings where id = requested_booking_id for update;
  if not found or selected_booking.customer_package_id is null then
    raise exception using errcode = 'P0002', message = 'package_booking_not_found';
  end if;
  if selected_booking.status not in ('completed', 'no_show') then
    raise exception using errcode = '22023', message = 'booking_not_consumable';
  end if;
  select * into selected_package from public.customer_packages
  where id = selected_booking.customer_package_id for update;

  insert into public.package_redemptions(package_id, booking_id, consumed_at, restored_at, decided_by, reason)
  values (
    selected_package.id, selected_booking.id,
    case when requested_consume then now() else null end,
    case when requested_consume then null else now() end,
    auth.uid(), normalized_reason
  )
  on conflict (booking_id) do update set
    consumed_at = case when requested_consume then coalesce(public.package_redemptions.consumed_at, now()) else public.package_redemptions.consumed_at end,
    restored_at = case when requested_consume then null else now() end,
    decided_by = auth.uid(), reason = normalized_reason, updated_at = now();

  select count(*)::integer into consumed_count from public.package_redemptions redemption
  where redemption.package_id = selected_package.id and redemption.consumed_at is not null and redemption.restored_at is null;
  if consumed_count >= selected_package.total_sessions then
    update public.customer_packages set status = 'completed' where id = selected_package.id and status = 'active';
  elsif selected_package.status = 'completed' and consumed_count < selected_package.total_sessions then
    update public.customer_packages set status = 'active' where id = selected_package.id;
  end if;
  return query select selected_package.id, consumed_count, greatest(0, selected_package.total_sessions - consumed_count);
end;
$$;

revoke all on function public.set_package_session_consumption(uuid, boolean, text) from public, anon;
grant execute on function public.set_package_session_consumption(uuid, boolean, text) to authenticated;

create or replace function public.get_available_slots_for_package(
  requested_package_id uuid,
  requested_date date
)
returns table (starts_at timestamptz, ends_at timestamptz)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  selected_package public.customer_packages%rowtype;
  selected_treatment public.treatments%rowtype;
  initial_booking public.bookings%rowtype;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into selected_package from public.customer_packages
  where id = requested_package_id and status = 'active' and expires_at > now();
  if not found then raise exception using errcode = 'P0002', message = 'package_not_available'; end if;
  select * into selected_treatment from public.treatments where id = selected_package.treatment_id;
  select * into initial_booking from public.bookings where id = selected_package.initial_booking_id;
  return query
  with config as (select timezone, minimum_notice_minutes from public.business_settings where singleton),
  windows as (
    select (requested_date + rule.start_time) at time zone cfg.timezone as window_start,
      (requested_date + rule.end_time) at time zone cfg.timezone as window_end
    from config cfg join public.availability_rules rule
      on rule.specialty_id = initial_booking.specialty_id
      and rule.weekday = extract(dow from requested_date)::smallint and rule.is_active
    union all
    select exception.starts_at, exception.ends_at from public.availability_exceptions exception
    where exception.specialty_id = initial_booking.specialty_id and exception.kind = 'open'
      and (exception.starts_at at time zone 'America/Argentina/Cordoba')::date = requested_date
  ), candidates as (
    select slot_start,
      slot_start + make_interval(mins => selected_package.duration_snapshot_minutes + selected_package.buffer_snapshot_minutes) as slot_end,
      window.window_end
    from windows window cross join lateral generate_series(
      window.window_start,
      window.window_end - make_interval(mins => selected_package.duration_snapshot_minutes + selected_package.buffer_snapshot_minutes),
      make_interval(mins => selected_treatment.start_interval_minutes)
    ) slot_start
  )
  select distinct candidate.slot_start, candidate.slot_end from candidates candidate cross join config cfg
  where candidate.slot_end <= candidate.window_end
    and candidate.slot_start >= now() + make_interval(mins => cfg.minimum_notice_minutes)
    and candidate.slot_start < selected_package.expires_at
    and not exists (select 1 from public.availability_exceptions exception
      where exception.specialty_id = initial_booking.specialty_id and exception.kind = 'blocked'
      and tstzrange(exception.starts_at, exception.ends_at, '[)') && tstzrange(candidate.slot_start, candidate.slot_end, '[)'))
    and not exists (select 1 from public.bookings booking
      where booking.specialty_id = initial_booking.specialty_id
      and booking.status in ('pending','awaiting_deposit','confirmed')
      and tstzrange(booking.starts_at, booking.ends_at, '[)') && tstzrange(candidate.slot_start, candidate.slot_end, '[)'))
  order by candidate.slot_start;
end;
$$;

revoke all on function public.get_available_slots_for_package(uuid, date) from public, anon;
grant execute on function public.get_available_slots_for_package(uuid, date) to authenticated;

create or replace function public.create_admin_package_booking(
  requested_package_id uuid,
  requested_starts_at timestamptz,
  requested_idempotency_key uuid,
  requested_internal_notes text default null
)
returns table (booking_id uuid, booking_code text, booking_status public.booking_status)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_package public.customer_packages%rowtype;
  selected_treatment public.treatments%rowtype;
  initial_booking public.bookings%rowtype;
  new_booking public.bookings%rowtype;
  scheduled_count integer;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into new_booking from public.bookings where idempotency_key = requested_idempotency_key;
  if found then return query select new_booking.id, new_booking.booking_code, new_booking.status; return; end if;
  select * into selected_package from public.customer_packages
  where id = requested_package_id and status = 'active' and expires_at > now() for update;
  if not found or requested_starts_at >= selected_package.expires_at then
    raise exception using errcode = 'P0002', message = 'package_not_available';
  end if;
  select count(*)::integer into scheduled_count
  from public.bookings booking
  left join public.package_redemptions redemption on redemption.booking_id = booking.id
  where booking.customer_package_id = selected_package.id
    and booking.status not in ('cancelled','expired')
    and not (
      booking.status in ('completed','no_show')
      and redemption.restored_at is not null
    );
  if scheduled_count >= selected_package.total_sessions then
    raise exception using errcode = '22023', message = 'package_has_no_sessions_to_schedule';
  end if;
  if not exists (
    select 1 from public.get_available_slots_for_package(selected_package.id,
      (requested_starts_at at time zone 'America/Argentina/Cordoba')::date) slot
    where slot.starts_at = requested_starts_at
  ) then raise exception using errcode = '23P01', message = 'slot_not_available'; end if;
  select * into selected_treatment from public.treatments where id = selected_package.treatment_id;
  select * into initial_booking from public.bookings where id = selected_package.initial_booking_id;
  insert into public.bookings(
    idempotency_key, customer_id, treatment_id, specialty_id, professional_id,
    treatment_combo_id, customer_package_id, starts_at, ends_at,
    duration_snapshot_minutes, buffer_snapshot_minutes, base_price_snapshot_cents,
    applied_price_snapshot_cents, treatment_name_snapshot, internal_notes,
    combo_name_snapshot, combo_mode_snapshot, combo_zones_snapshot,
    combo_session_count_snapshot, combo_validity_days_snapshot,
    combo_reference_price_snapshot_cents, combo_price_per_session_snapshot_cents,
    combo_savings_snapshot_cents, package_charge_kind, status,
    confirmed_at, deposit_confirmed_at, status_changed_at, status_changed_by
  ) values (
    requested_idempotency_key, selected_package.customer_id, selected_package.treatment_id,
    initial_booking.specialty_id, initial_booking.professional_id,
    selected_package.combo_id, selected_package.id, requested_starts_at,
    requested_starts_at + make_interval(mins => selected_package.duration_snapshot_minutes + selected_package.buffer_snapshot_minutes),
    selected_package.duration_snapshot_minutes, selected_package.buffer_snapshot_minutes,
    selected_package.fixed_price_snapshot_cents, 0, selected_treatment.name,
    nullif(trim(requested_internal_notes), ''), selected_package.combo_name_snapshot,
    'package', selected_package.zones_snapshot, selected_package.total_sessions,
    selected_package.validity_days_snapshot, selected_package.fixed_price_snapshot_cents,
    selected_package.price_per_session_snapshot_cents, selected_package.savings_snapshot_cents,
    'package_included', 'confirmed', now(), now(), now(), auth.uid()
  ) returning * into new_booking;
  insert into public.booking_status_history(booking_id, previous_status, next_status, reason, actor_id)
  values (new_booking.id, null, 'confirmed', 'Sesión asignada desde un paquete activo', auth.uid());
  return query select new_booking.id, new_booking.booking_code, new_booking.status;
exception when exclusion_violation then
  raise exception using errcode = '23P01', message = 'slot_not_available';
end;
$$;

revoke all on function public.create_admin_package_booking(uuid, timestamptz, uuid, text) from public, anon;
grant execute on function public.create_admin_package_booking(uuid, timestamptz, uuid, text) to authenticated;

create or replace function public.extend_customer_package(
  requested_package_id uuid,
  requested_expires_at timestamptz,
  requested_reason text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare normalized_reason text := nullif(trim(requested_reason), '');
  current_expiration timestamptz;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if normalized_reason is null or char_length(normalized_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'extension_reason_required';
  end if;
  select expires_at into current_expiration
  from public.customer_packages
  where id = requested_package_id
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'package_not_found'; end if;
  if requested_expires_at <= current_expiration then
    raise exception using errcode = '22023', message = 'package_extension_must_move_forward';
  end if;
  update public.customer_packages
  set expires_at = requested_expires_at, status_reason = normalized_reason,
      status = case when status = 'expired' and requested_expires_at > now() then 'active' else status end
  where id = requested_package_id;
  return requested_expires_at;
end;
$$;

revoke all on function public.extend_customer_package(uuid, timestamptz, text) from public, anon;
grant execute on function public.extend_customer_package(uuid, timestamptz, text) to authenticated;

-- Preserve the historical RPC signatures for simple treatments, but make them
-- delegate to the selection-aware contract. A closed-combo treatment can no
-- longer be booked by calling an older endpoint without a combo.
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
  if not exists (
    select 1 from public.treatments treatment
    where treatment.id = requested_treatment_id
      and treatment.is_active
      and treatment.selection_mode = 'simple'
  ) then
    return;
  end if;

  return query
  select slot.starts_at, slot.ends_at
  from public.get_available_slots_for_selection(
    requested_treatment_id,
    null,
    requested_date
  ) slot;
end;
$$;

revoke all on function public.get_available_slots(uuid, date) from public, authenticated;
grant execute on function public.get_available_slots(uuid, date) to anon;

create or replace function public.create_booking(
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
language sql
volatile
security definer
set search_path = ''
as $$
  select result.booking_id, result.booking_code, result.status
  from public.create_booking_for_selection(
    requested_treatment_id,
    null,
    requested_monthly_special_id,
    requested_starts_at,
    requested_idempotency_key,
    customer_full_name,
    customer_phone,
    customer_email,
    customer_notes,
    request_guard_nonce,
    request_guard_fingerprint,
    request_guard_secret
  ) result;
$$;

revoke all on function public.create_booking(
  uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text
) from public, authenticated;
grant execute on function public.create_booking(
  uuid, uuid, timestamptz, uuid, text, text, text, text, uuid, text, text
) to anon;

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
language sql
volatile
security invoker
set search_path = ''
as $$
  select result.booking_id, result.booking_code, result.booking_status
  from public.create_admin_booking_for_selection(
    requested_treatment_id,
    null,
    requested_monthly_special_id,
    requested_starts_at,
    requested_status,
    requested_idempotency_key,
    customer_full_name,
    customer_phone,
    customer_email,
    customer_notes,
    internal_notes
  ) result;
$$;

revoke all on function public.create_admin_booking(
  uuid, uuid, timestamptz, public.booking_status, uuid,
  text, text, text, text, text
) from public, anon;
grant execute on function public.create_admin_booking(
  uuid, uuid, timestamptz, public.booking_status, uuid,
  text, text, text, text, text
) to authenticated;

-- Permanent deletion is limited to never-used configuration and protected by
-- the same server-side secret used by treatment deletion. Referenced rows must
-- be deactivated so their historical snapshots remain explainable.
revoke delete on public.depilation_zones, public.treatment_combos from authenticated;

create or replace function public.delete_treatment_combo_if_unlinked(
  requested_combo_id uuid,
  request_guard_secret text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare stored_guard_hash text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select secret_hash into stored_guard_hash from private.booking_guard_config where singleton;
  if stored_guard_hash is null or request_guard_secret is null
    or char_length(request_guard_secret) < 32
    or encode(extensions.digest(request_guard_secret, 'sha256'), 'hex') <> stored_guard_hash then
    raise exception using errcode = '42501', message = 'deletion_guard_invalid';
  end if;
  perform 1 from public.treatment_combos combo where combo.id = requested_combo_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'combo_not_found'; end if;
  if exists (select 1 from public.bookings booking where booking.treatment_combo_id = requested_combo_id)
    or exists (select 1 from public.customer_packages package where package.combo_id = requested_combo_id) then
    raise exception using errcode = '23503', message = 'combo_has_history';
  end if;
  delete from public.treatment_combos combo where combo.id = requested_combo_id;
  return requested_combo_id;
end;
$$;

revoke all on function public.delete_treatment_combo_if_unlinked(uuid, text) from public, anon;
grant execute on function public.delete_treatment_combo_if_unlinked(uuid, text) to authenticated;

create or replace function public.delete_depilation_zone_if_unlinked(
  requested_zone_id uuid,
  request_guard_secret text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare stored_guard_hash text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  select secret_hash into stored_guard_hash from private.booking_guard_config where singleton;
  if stored_guard_hash is null or request_guard_secret is null
    or char_length(request_guard_secret) < 32
    or encode(extensions.digest(request_guard_secret, 'sha256'), 'hex') <> stored_guard_hash then
    raise exception using errcode = '42501', message = 'deletion_guard_invalid';
  end if;
  perform 1 from public.depilation_zones zone where zone.id = requested_zone_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'zone_not_found'; end if;
  if exists (select 1 from public.treatment_combo_zones link where link.zone_id = requested_zone_id) then
    raise exception using errcode = '23503', message = 'zone_is_in_use';
  end if;
  delete from public.depilation_zones zone where zone.id = requested_zone_id;
  return requested_zone_id;
end;
$$;

revoke all on function public.delete_depilation_zone_if_unlinked(uuid, text) from public, anon;
grant execute on function public.delete_depilation_zone_if_unlinked(uuid, text) to authenticated;

comment on column public.treatments.selection_mode is
  'simple preserves the existing flow; closed_combo requires one published server-resolved combo.';
comment on table public.package_redemptions is
  'One idempotent consumption decision per package booking. restored_at reverses consumption without deleting audit history.';

create or replace function public.capture_admin_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  old_snapshot jsonb;
  new_snapshot jsonb;
begin
  if public.is_admin(auth.uid()) then
    old_snapshot := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
    new_snapshot := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
    if tg_table_name = 'bookings' then
      old_snapshot := old_snapshot - array['customer_id', 'customer_notes', 'internal_notes'];
      new_snapshot := new_snapshot - array['customer_id', 'customer_notes', 'internal_notes'];
    elsif tg_table_name = 'customer_packages' then
      old_snapshot := old_snapshot - 'customer_id';
      new_snapshot := new_snapshot - 'customer_id';
    end if;
    insert into public.audit_log(actor_id, table_name, record_id, action, old_data, new_data)
    values (
      auth.uid(), tg_table_name,
      nullif(coalesce(row_data->>'id', row_data->>'user_id'), '')::uuid,
      lower(tg_op), old_snapshot, new_snapshot
    );
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_admin_audit() from public, anon, authenticated;
