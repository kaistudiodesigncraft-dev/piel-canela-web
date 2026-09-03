-- Auditoría exclusivamente de lectura. No devuelve teléfonos, correos, notas ni nombres de clientes.
-- Ejecutar antes y después de cada migración de producción.

select jsonb_build_object(
  'captured_at', now(),
  'treatments_total', (select count(*) from public.treatments),
  'treatments_published', (select count(*) from public.treatments where is_active),
  'monthly_specials_total', (select count(*) from public.monthly_specials),
  'professionals_total', (select count(*) from public.professionals),
  'specialties_total', (select count(*) from public.specialties),
  'availability_rules_total', (select count(*) from public.availability_rules),
  'bookings_total', (select count(*) from public.bookings),
  'customers_total', (select count(*) from public.customers),
  'treatment_media_objects', (
    select count(*) from storage.objects where bucket_id = 'treatment-media'
  ),
  'site_content_media_objects', (
    select count(*) from storage.objects where bucket_id = 'site-content-media'
  ),
  'latest_migration', (
    select max(version) from supabase_migrations.schema_migrations
  )
) as production_inventory;

select id, slug, is_active, specialty_id, updated_at
from public.treatments
order by id;

select id, slug, is_active, updated_at
from public.specialties
order by id;

select id, specialty_id, is_active, updated_at
from public.professionals
order by id;

select bucket_id, name, created_at, updated_at
from storage.objects
where bucket_id in ('treatment-media', 'site-content-media', 'admin-media-ingest')
   or bucket_id in ('treatment-media-ingest', 'site-content-media-ingest')
order by bucket_id, name;
