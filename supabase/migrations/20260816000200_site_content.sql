-- Fixed-page content editor. Rows are seeded and cannot be created or deleted by application users.

create type public.site_content_kind as enum ('short_text', 'long_text', 'image');
create type public.site_content_section as enum ('hero', 'categories', 'approach', 'booking', 'faq');

create table public.site_content (
  key text primary key check (key in (
    'hero_eyebrow', 'hero_title', 'hero_lead', 'hero_image', 'hero_image_caption',
    'categories_eyebrow', 'categories_title', 'categories_lead',
    'approach_eyebrow', 'approach_title', 'approach_body_primary', 'approach_body_secondary',
    'booking_eyebrow', 'booking_title',
    'booking_step_1_title', 'booking_step_1_text', 'booking_step_2_title', 'booking_step_2_text',
    'booking_step_3_title', 'booking_step_3_text', 'booking_step_4_title', 'booking_step_4_text',
    'faq_eyebrow', 'faq_title', 'faq_1_question', 'faq_1_answer', 'faq_2_question',
    'faq_2_answer', 'faq_3_question', 'faq_3_answer'
  )),
  section public.site_content_section not null,
  label text not null,
  kind public.site_content_kind not null,
  value text not null,
  image_path text,
  image_alt text,
  display_order integer not null,
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_content_image_complete check (
    kind <> 'image' or nullif(trim(coalesce(image_alt, '')), '') is not null
  )
);

insert into public.site_content(key, section, label, kind, value, image_path, image_alt, display_order)
values
  ('hero_eyebrow', 'hero', 'Texto superior', 'short_text', 'Bienestar, estética y recuperación', null, null, 1),
  ('hero_title', 'hero', 'Título principal', 'short_text', 'Cuidado profesional para cada momento.', null, null, 2),
  ('hero_lead', 'hero', 'Introducción', 'long_text', 'Conocé cada tratamiento, entendé qué podés esperar y elegí el momento que mejor se adapte a vos.', null, null, 3),
  ('hero_image', 'hero', 'Imagen principal', 'image', '/images/treatment-massage-concept.png', null, 'Fotografía conceptual de muestra de un tratamiento corporal', 4),
  ('hero_image_caption', 'hero', 'Epígrafe de imagen', 'short_text', 'Un recorrido simple desde la elección hasta la pre-reserva.', null, null, 5),
  ('categories_eyebrow', 'categories', 'Texto superior', 'short_text', 'Encontrá tu recorrido', null, null, 1),
  ('categories_title', 'categories', 'Título', 'short_text', 'Nuestros tratamientos', null, null, 2),
  ('categories_lead', 'categories', 'Introducción', 'long_text', 'Elegí el camino que mejor se adapta a lo que necesitás hoy.', null, null, 3),
  ('approach_eyebrow', 'approach', 'Texto superior', 'short_text', 'Una elección informada', null, null, 1),
  ('approach_title', 'approach', 'Título', 'short_text', 'Cuidado cercano, información concreta.', null, null, 2),
  ('approach_body_primary', 'approach', 'Primer párrafo', 'long_text', 'Piel Canela reúne propuestas de bienestar, estética y recuperación dentro del entorno de Espacio O2. La web organiza esa variedad para que puedas entender cada opción antes de consultar.', null, null, 3),
  ('approach_body_secondary', 'approach', 'Segundo párrafo', 'long_text', 'Cuando un tratamiento necesita una evaluación previa, lo indicamos con claridad. La reserva queda pendiente hasta confirmar la seña por WhatsApp.', null, null, 4),
  ('booking_eyebrow', 'booking', 'Texto superior', 'short_text', 'Reservar es simple', null, null, 1),
  ('booking_title', 'booking', 'Título', 'short_text', 'Elegí con claridad y confirmá por WhatsApp.', null, null, 2),
  ('booking_step_1_title', 'booking', 'Paso 1', 'short_text', 'Elegí', null, null, 3),
  ('booking_step_1_text', 'booking', 'Descripción del paso 1', 'long_text', 'Explorá categorías y abrí el detalle completo.', null, null, 4),
  ('booking_step_2_title', 'booking', 'Paso 2', 'short_text', 'Seleccioná', null, null, 5),
  ('booking_step_2_text', 'booking', 'Descripción del paso 2', 'long_text', 'Indicá el tratamiento que querés reservar.', null, null, 6),
  ('booking_step_3_title', 'booking', 'Paso 3', 'short_text', 'Completá', null, null, 7),
  ('booking_step_3_text', 'booking', 'Descripción del paso 3', 'long_text', 'Elegí entre los días y horarios disponibles.', null, null, 8),
  ('booking_step_4_title', 'booking', 'Paso 4', 'short_text', 'Confirmá', null, null, 9),
  ('booking_step_4_text', 'booking', 'Descripción del paso 4', 'long_text', 'La seña y la confirmación final se coordinan por WhatsApp.', null, null, 10),
  ('faq_eyebrow', 'faq', 'Texto superior', 'short_text', 'Antes de reservar', null, null, 1),
  ('faq_title', 'faq', 'Título', 'short_text', 'Preguntas frecuentes', null, null, 2),
  ('faq_1_question', 'faq', 'Pregunta 1', 'short_text', '¿La pre-reserva confirma mi turno?', null, null, 3),
  ('faq_1_answer', 'faq', 'Respuesta 1', 'long_text', 'No. El horario se confirma cuando Piel Canela valida la seña por WhatsApp.', null, null, 4),
  ('faq_2_question', 'faq', 'Pregunta 2', 'short_text', '¿Necesito crear una cuenta?', null, null, 5),
  ('faq_2_answer', 'faq', 'Respuesta 2', 'long_text', 'No. Solo se piden los datos mínimos para identificar y coordinar tu solicitud.', null, null, 6),
  ('faq_3_question', 'faq', 'Pregunta 3', 'short_text', '¿Qué pasa si no sé qué tratamiento elegir?', null, null, 7),
  ('faq_3_answer', 'faq', 'Respuesta 3', 'long_text', 'Podés explorar por categoría y consultar cuando una evaluación previa sea necesaria.', null, null, 8);

create trigger site_content_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

create trigger site_content_audit
  after update on public.site_content
  for each row execute function public.capture_admin_audit();

alter table public.site_content enable row level security;

create policy site_content_public_read on public.site_content for select to anon, authenticated
  using (true);
create policy site_content_admin_update on public.site_content for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.site_content to anon, authenticated;
grant update (value, image_path, image_alt, updated_by) on public.site_content to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content-media',
  'site-content-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy site_content_media_public_read on storage.objects for select to public
  using (bucket_id = 'site-content-media');
create policy site_content_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-content-media' and public.is_admin());

create or replace function public.get_public_booking_settings()
returns table (whatsapp_number text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.whatsapp_number
  from public.business_settings b
  where b.singleton;
$$;

revoke all on function public.get_public_booking_settings() from public;
grant execute on function public.get_public_booking_settings() to anon, authenticated;
