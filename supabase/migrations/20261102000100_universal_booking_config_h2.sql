-- H2: neutral, configurable booking catalog.
-- Additive only. Existing selection_mode, Depilation tables, functions and
-- policies remain untouched and continue to be authoritative for legacy rows.

alter table public.treatments
  add column booking_config jsonb,
  add column config_enabled boolean not null default false,
  add constraint treatments_booking_config_shape check (
    booking_config is null
    or (
      jsonb_typeof(booking_config) = 'object'
      and booking_config @> '{"version": 1}'::jsonb
    )
  ),
  add constraint treatments_enabled_config_required check (
    not config_enabled or booking_config is not null
  );

comment on column public.treatments.booking_config is
  'Versioned universal booking configuration. Ignored while config_enabled is false.';
comment on column public.treatments.config_enabled is
  'Explicit opt-in for the universal configurable booking path.';

create table public.treatment_options (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(trim(description)) <= 500),
  price_cents integer not null default 0 check (price_cents between 0 and 2147483647),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  display_order integer not null default 0 check (display_order between 0 and 9999),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_options_active_values check (
    not is_active or (price_cents > 0 and duration_minutes > 0)
  ),
  constraint treatment_options_id_treatment_unique unique (id, treatment_id)
);

create unique index treatment_options_name_unique_idx
  on public.treatment_options (treatment_id, lower(trim(name)));
create index treatment_options_public_idx
  on public.treatment_options (treatment_id, display_order, name)
  where is_active and price_cents > 0;

create table public.treatment_option_combos (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(trim(description)) <= 500),
  kind text not null default 'combo' check (kind in ('combo', 'package')),
  price_cents integer not null default 0 check (price_cents between 0 and 2147483647),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  session_count integer not null default 1 check (session_count between 1 and 100),
  display_order integer not null default 0 check (display_order between 0 and 9999),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_option_combos_active_values check (
    not is_active or (price_cents > 0 and duration_minutes > 0)
  ),
  constraint treatment_option_combos_id_treatment_unique unique (id, treatment_id)
);

create unique index treatment_option_combos_name_unique_idx
  on public.treatment_option_combos (treatment_id, lower(trim(name)));
create index treatment_option_combos_public_idx
  on public.treatment_option_combos (treatment_id, display_order, name)
  where is_active and price_cents > 0;

create table public.treatment_option_combo_items (
  id uuid primary key default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  combo_id uuid not null,
  option_id uuid not null,
  role text not null default 'included' check (role in ('included', 'addon')),
  display_order integer not null default 0 check (display_order between 0 and 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_option_combo_items_combo_fk
    foreign key (combo_id, treatment_id)
    references public.treatment_option_combos(id, treatment_id)
    on delete cascade,
  constraint treatment_option_combo_items_option_fk
    foreign key (option_id, treatment_id)
    references public.treatment_options(id, treatment_id)
    on delete restrict,
  constraint treatment_option_combo_items_unique unique (combo_id, option_id)
);

create index treatment_option_combo_items_option_idx
  on public.treatment_option_combo_items (option_id, combo_id);

create trigger treatment_options_updated_at
  before update on public.treatment_options
  for each row execute function public.set_updated_at();
create trigger treatment_option_combos_updated_at
  before update on public.treatment_option_combos
  for each row execute function public.set_updated_at();
create trigger treatment_option_combo_items_updated_at
  before update on public.treatment_option_combo_items
  for each row execute function public.set_updated_at();

create trigger treatment_options_audit
  after insert or update or delete on public.treatment_options
  for each row execute function public.capture_admin_audit();
create trigger treatment_option_combos_audit
  after insert or update or delete on public.treatment_option_combos
  for each row execute function public.capture_admin_audit();
create trigger treatment_option_combo_items_audit
  after insert or update or delete on public.treatment_option_combo_items
  for each row execute function public.capture_admin_audit();

alter table public.treatment_options enable row level security;
alter table public.treatment_option_combos enable row level security;
alter table public.treatment_option_combo_items enable row level security;

create policy treatment_options_public_read
  on public.treatment_options
  for select to anon
  using (
    is_active
    and price_cents > 0
    and exists (
      select 1
      from public.treatments as treatment
      where treatment.id = treatment_options.treatment_id
        and treatment.is_active
        and treatment.config_enabled
    )
  );

create policy treatment_option_combos_public_read
  on public.treatment_option_combos
  for select to anon
  using (
    is_active
    and price_cents > 0
    and exists (
      select 1
      from public.treatments as treatment
      where treatment.id = treatment_option_combos.treatment_id
        and treatment.is_active
        and treatment.config_enabled
    )
  );

create policy treatment_option_combo_items_public_read
  on public.treatment_option_combo_items
  for select to anon
  using (
    exists (
      select 1
      from public.treatment_option_combos as combo
      join public.treatments as treatment on treatment.id = combo.treatment_id
      where combo.id = treatment_option_combo_items.combo_id
        and combo.treatment_id = treatment_option_combo_items.treatment_id
        and combo.is_active
        and combo.price_cents > 0
        and treatment.is_active
        and treatment.config_enabled
    )
    and exists (
      select 1
      from public.treatment_options as option
      where option.id = treatment_option_combo_items.option_id
        and option.treatment_id = treatment_option_combo_items.treatment_id
        and option.is_active
        and option.price_cents > 0
    )
  );

create policy treatment_options_admin_all
  on public.treatment_options
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
create policy treatment_option_combos_admin_all
  on public.treatment_option_combos
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
create policy treatment_option_combo_items_admin_all
  on public.treatment_option_combo_items
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

revoke all on public.treatment_options from anon, authenticated;
revoke all on public.treatment_option_combos from anon, authenticated;
revoke all on public.treatment_option_combo_items from anon, authenticated;

grant select on public.treatment_options to anon;
grant select on public.treatment_option_combos to anon;
grant select on public.treatment_option_combo_items to anon;

grant select, insert, update, delete on public.treatment_options to authenticated;
grant select, insert, update, delete on public.treatment_option_combos to authenticated;
grant select, insert, update, delete on public.treatment_option_combo_items to authenticated;
