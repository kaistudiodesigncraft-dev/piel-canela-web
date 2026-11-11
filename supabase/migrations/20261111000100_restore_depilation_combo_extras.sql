-- Restore the existing add-on catalog as selectable combo extras.
-- Additive/non-destructive: no extra, zone, combo, treatment or booking is deleted
-- or converted. Existing add-on prices and durations remain authoritative.
begin;

create table if not exists private.depilation_extra_restore_manifest (
  migration_key text not null,
  combo_id uuid not null references public.treatment_combos(id) on delete cascade,
  extra_id uuid not null references public.treatment_combo_extras(id) on delete cascade,
  combo_was_enabled boolean not null,
  primary key (migration_key, combo_id, extra_id)
);

with normalized_zones as (
  select link.combo_id,
    regexp_replace(
      lower(regexp_replace(translate(zone.name,
        'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[^a-zA-Z0-9]+', '', 'g')),
      's$', ''
    ) as normalized_name
  from public.treatment_combo_zones link
  join public.depilation_zones zone on zone.id = link.zone_id
), candidates as (
  select combo.id as combo_id, extra.id as extra_id,
    combo.allow_public_extras as combo_was_enabled
  from public.treatment_combos combo
  join public.treatment_combo_extras extra
    on extra.treatment_id = combo.treatment_id
   and extra.is_active
   and (extra.audience = 'shared' or extra.audience = combo.audience)
  where combo.is_active
    and combo.fixed_price_cents > 0
    and not exists (
      select 1
      from normalized_zones included
      where included.combo_id = combo.id
        and included.normalized_name = regexp_replace(
          lower(regexp_replace(translate(extra.name,
            'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'), '[^a-zA-Z0-9]+', '', 'g')),
          's$', ''
        )
    )
    and not exists (
      select 1 from public.treatment_combo_allowed_extras current_link
      where current_link.combo_id = combo.id and current_link.extra_id = extra.id
    )
)
insert into private.depilation_extra_restore_manifest(
  migration_key, combo_id, extra_id, combo_was_enabled
)
select '20261111000100', combo_id, extra_id, combo_was_enabled
from candidates
on conflict do nothing;

insert into public.treatment_combo_allowed_extras(combo_id, extra_id)
select combo_id, extra_id
from private.depilation_extra_restore_manifest
where migration_key = '20261111000100'
on conflict do nothing;

update public.treatment_combos combo
set allow_public_extras = true,
    updated_at = now()
where exists (
  select 1
  from public.treatment_combo_allowed_extras allowed
  join public.treatment_combo_extras extra on extra.id = allowed.extra_id
  where allowed.combo_id = combo.id and extra.is_active
)
and combo.allow_public_extras is distinct from true;

commit;
