-- Auditoría de solo lectura para ejecutar después de aplicar la migración de
-- combos. No devuelve nombres de clientes, teléfonos, correos ni notas.

select jsonb_build_object(
  'captured_at', now(),
  'treatments_total', (select count(*) from public.treatments),
  'simple_treatments', (select count(*) from public.treatments where selection_mode = 'simple'),
  'closed_combo_treatments', (select count(*) from public.treatments where selection_mode = 'closed_combo'),
  'professionals_total', (select count(*) from public.professionals),
  'specialties_total', (select count(*) from public.specialties),
  'availability_rules_total', (select count(*) from public.availability_rules),
  'bookings_total', (select count(*) from public.bookings),
  'zones_total', (select count(*) from public.depilation_zones),
  'combos_total', (select count(*) from public.treatment_combos),
  'packages_total', (select count(*) from public.customer_packages),
  'redemptions_total', (select count(*) from public.package_redemptions),
  'feature_enabled', (
    select depilation_combos_enabled from public.business_settings where singleton
  ),
  'latest_migration', (
    select max(version) from supabase_migrations.schema_migrations
  )
) as depilation_release_inventory;

select id, slug, selection_mode, is_active, specialty_id, updated_at
from public.treatments
order by id;

select id, specialty_id, is_active, updated_at
from public.professionals
order by id;

select id, specialty_id, weekday, start_time, end_time, is_active, updated_at
from public.availability_rules
order by id;

select bucket_id, name, created_at, updated_at
from storage.objects
where bucket_id in (
  'treatment-media', 'site-content-media', 'admin-media-ingest',
  'treatment-media-ingest', 'site-content-media-ingest'
)
order by bucket_id, name;

select jsonb_build_object(
  'active_combos_without_zones', (
    select count(*) from public.treatment_combos combo
    where combo.is_active and not exists (
      select 1 from public.treatment_combo_zones link where link.combo_id = combo.id
    )
  ),
  'closed_treatments_without_active_combo', (
    select count(*) from public.treatments treatment
    where treatment.is_active and treatment.selection_mode = 'closed_combo'
      and not exists (
        select 1 from public.treatment_combos combo
        where combo.treatment_id = treatment.id and combo.is_active
      )
  ),
  'combo_special_booking_conflicts', (
    select count(*) from public.bookings
    where treatment_combo_id is not null and monthly_special_id is not null
  ),
  'package_bookings_without_package', (
    select count(*) from public.bookings
    where package_charge_kind in ('package_initial', 'package_included')
      and customer_package_id is null
      and status = 'confirmed'
  ),
  'combo_audience_conflicts', (
    select count(*)
    from public.treatment_combo_zones link
    join public.treatment_combos combo on combo.id = link.combo_id
    join public.depilation_zones zone on zone.id = link.zone_id
    where zone.audience <> 'shared' and zone.audience <> combo.audience
  )
) as depilation_integrity_checks;
