-- Controlled site-content workflow.
-- Existing rows remain the published source of truth. Drafts are seeded from them
-- and all mutations happen through audited, fixed-key RPCs. Enum values are added
-- in the immediately preceding migration so they are committed before use here.

alter table public.site_content drop constraint if exists site_content_key_check;
alter table public.site_content
  add constraint site_content_key_check check (key in (
    'hero_eyebrow', 'hero_title', 'hero_lead', 'hero_image', 'hero_image_caption',
    'categories_eyebrow', 'categories_title', 'categories_lead', 'categories_background',
    'specials_eyebrow', 'specials_title', 'specials_lead', 'specials_background',
    'approach_eyebrow', 'approach_title', 'approach_body_primary', 'approach_body_secondary', 'approach_background',
    'booking_eyebrow', 'booking_title',
    'booking_step_1_title', 'booking_step_1_text', 'booking_step_2_title', 'booking_step_2_text',
    'booking_step_3_title', 'booking_step_3_text', 'booking_step_4_title', 'booking_step_4_text', 'booking_background',
    'faq_eyebrow', 'faq_title', 'faq_1_question', 'faq_1_answer', 'faq_2_question',
    'faq_2_answer', 'faq_3_question', 'faq_3_answer', 'faq_background',
    'catalog_header_eyebrow', 'catalog_header_title', 'catalog_header_lead', 'catalog_header_image',
    'booking_header_eyebrow', 'booking_header_title', 'booking_header_lead', 'booking_header_image'
  ));

alter table public.site_content
  add column if not exists focal_x smallint not null default 50 check (focal_x between 0 and 100),
  add column if not exists focal_y smallint not null default 50 check (focal_y between 0 and 100),
  add column if not exists presentation text not null default 'content' check (presentation in ('content', 'background')),
  add column if not exists surface_preset text not null default 'plain' check (surface_preset in ('plain', 'soft', 'contrast')),
  add column if not exists overlay_preset text not null default 'none' check (overlay_preset in ('none', 'light', 'medium', 'strong')),
  add column if not exists enabled boolean not null default true;

alter table public.site_content drop constraint if exists site_content_image_complete;
alter table public.site_content add constraint site_content_image_complete check (
  kind <> 'image'
  or presentation = 'background'
  or nullif(trim(coalesce(image_alt, '')), '') is not null
);

insert into public.site_content (
  key, section, label, kind, value, image_path, image_alt, display_order,
  presentation, surface_preset, overlay_preset
)
values
  ('categories_background', 'categories', 'Fondo de categorías', 'image', '', null, '', 4, 'background', 'soft', 'light'),
  ('specials_eyebrow', 'specials', 'Texto superior', 'short_text', 'Propuestas temporales', null, null, 1, 'content', 'plain', 'none'),
  ('specials_title', 'specials', 'Título', 'short_text', 'Especiales del mes', null, null, 2, 'content', 'plain', 'none'),
  ('specials_lead', 'specials', 'Introducción', 'long_text', 'Tratamientos seleccionados por Piel Canela con vigencia y valor promocional.', null, null, 3, 'content', 'plain', 'none'),
  ('specials_background', 'specials', 'Fondo de especiales', 'image', '', null, '', 4, 'background', 'soft', 'light'),
  ('approach_background', 'approach', 'Fondo de presentación', 'image', '', null, '', 5, 'background', 'soft', 'light'),
  ('booking_background', 'booking', 'Fondo de cómo reservar', 'image', '', null, '', 11, 'background', 'soft', 'light'),
  ('faq_background', 'faq', 'Fondo de preguntas frecuentes', 'image', '', null, '', 9, 'background', 'soft', 'light'),
  ('catalog_header_eyebrow', 'catalog_header', 'Texto superior', 'short_text', 'Catálogo Piel Canela', null, null, 1, 'content', 'plain', 'none'),
  ('catalog_header_title', 'catalog_header', 'Título', 'short_text', 'Encontrá el tratamiento adecuado.', null, null, 2, 'content', 'plain', 'none'),
  ('catalog_header_lead', 'catalog_header', 'Introducción', 'long_text', 'Filtrá por categoría y abrí cada ficha para conocer qué incluye, cuánto dura y qué considerar antes de reservar.', null, null, 3, 'content', 'plain', 'none'),
  ('catalog_header_image', 'catalog_header', 'Imagen de cabecera', 'image', '', null, '', 4, 'background', 'soft', 'medium'),
  ('booking_header_eyebrow', 'booking_header', 'Texto superior', 'short_text', 'Reservá tu tratamiento', null, null, 1, 'content', 'plain', 'none'),
  ('booking_header_title', 'booking_header', 'Título', 'short_text', 'Elegí un día y horario disponible.', null, null, 2, 'content', 'plain', 'none'),
  ('booking_header_lead', 'booking_header', 'Introducción', 'long_text', 'Tu solicitud queda pendiente hasta que Piel Canela confirme la seña por WhatsApp.', null, null, 3, 'content', 'plain', 'none'),
  ('booking_header_image', 'booking_header', 'Imagen de cabecera', 'image', '', null, '', 4, 'background', 'soft', 'medium')
on conflict (key) do nothing;

update public.site_content
set enabled = false
where key in (
  'categories_background', 'specials_background', 'approach_background',
  'booking_background', 'faq_background', 'catalog_header_image', 'booking_header_image'
) and image_path is null and value = '';

create table public.site_content_drafts (
  key text primary key references public.site_content(key) on update cascade on delete restrict,
  section public.site_content_section not null,
  label text not null,
  kind public.site_content_kind not null,
  value text not null,
  image_path text,
  image_alt text,
  display_order integer not null,
  focal_x smallint not null default 50 check (focal_x between 0 and 100),
  focal_y smallint not null default 50 check (focal_y between 0 and 100),
  presentation text not null default 'content' check (presentation in ('content', 'background')),
  surface_preset text not null default 'plain' check (surface_preset in ('plain', 'soft', 'contrast')),
  overlay_preset text not null default 'none' check (overlay_preset in ('none', 'light', 'medium', 'strong')),
  enabled boolean not null default true,
  updated_by uuid references public.profiles(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_content_drafts_image_complete check (
    kind <> 'image' or presentation = 'background'
    or nullif(trim(coalesce(image_alt, '')), '') is not null
  )
);

insert into public.site_content_drafts
select key, section, label, kind, value, image_path, image_alt, display_order,
  focal_x, focal_y, presentation, surface_preset, overlay_preset, enabled,
  updated_by, updated_at
from public.site_content;

create table public.site_content_revisions (
  id uuid primary key default gen_random_uuid(),
  section public.site_content_section not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'array'),
  reason text not null default 'publish' check (reason in ('publish', 'restore')),
  created_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now()
);

create index site_content_revisions_section_created_idx
  on public.site_content_revisions(section, created_at desc);

create trigger site_content_drafts_updated_at
  before update on public.site_content_drafts
  for each row execute function public.set_updated_at();

create trigger site_content_drafts_audit
  after update on public.site_content_drafts
  for each row execute function public.capture_admin_audit();

create trigger site_content_revisions_audit
  after insert on public.site_content_revisions
  for each row execute function public.capture_admin_audit();

alter table public.site_content_drafts enable row level security;
alter table public.site_content_revisions enable row level security;

create policy site_content_drafts_admin_read on public.site_content_drafts
  for select to authenticated using (public.is_admin());
create policy site_content_revisions_admin_read on public.site_content_revisions
  for select to authenticated using (public.is_admin());

grant select on public.site_content_drafts, public.site_content_revisions to authenticated;
grant select on public.site_content to anon, authenticated;
revoke update (value, image_path, image_alt, updated_by) on public.site_content from authenticated;

create or replace function public.save_site_content_draft(
  p_section public.site_content_section,
  p_entries jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_at timestamptz := now();
  expected_count integer;
  supplied_count integer;
  unique_count integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'invalid_entries' using errcode = '22023';
  end if;

  select count(*) into expected_count
  from public.site_content_drafts where section = p_section;
  select count(*), count(distinct entry->>'key')
    into supplied_count, unique_count
  from jsonb_array_elements(p_entries) as entry;

  if supplied_count = 0 or supplied_count <> unique_count or supplied_count <> expected_count then
    raise exception 'duplicate_or_empty_entries' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_entries) as entry
    left join public.site_content_drafts draft on draft.key = entry->>'key'
    where draft.key is null or draft.section <> p_section
  ) then
    raise exception 'unknown_content_key' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_entries) as entry
    join public.site_content_drafts draft on draft.key = entry->>'key'
    where
      (draft.kind = 'short_text' and (length(trim(coalesce(entry->>'value', ''))) not between 1 and 180))
      or (draft.kind = 'long_text' and (length(trim(coalesce(entry->>'value', ''))) not between 1 and 1400))
      or (draft.kind <> 'image' and coalesce(entry->>'value', '') ~ '<[^>]*>')
      or (draft.kind = 'image' and draft.presentation <> 'background'
        and length(trim(coalesce(entry->>'image_alt', ''))) not between 3 and 240)
      or (draft.kind = 'image' and nullif(trim(coalesce(entry->>'image_path', '')), '') is not null
        and trim(entry->>'image_path') !~ '^((drafts|published)/[a-z0-9_-]+/[a-f0-9-]+\.(jpg|png|webp|avif)|/images/[a-zA-Z0-9_./-]+)$')
      or coalesce((entry->>'focal_x')::integer, 50) not between 0 and 100
      or coalesce((entry->>'focal_y')::integer, 50) not between 0 and 100
      or coalesce(entry->>'surface_preset', 'plain') not in ('plain', 'soft', 'contrast')
      or coalesce(entry->>'overlay_preset', 'none') not in ('none', 'light', 'medium', 'strong')
  ) then
    raise exception 'invalid_content_value' using errcode = '22023';
  end if;

  update public.site_content_drafts as draft set
    value = case when draft.kind = 'image' then draft.value else trim(entry.value) end,
    image_path = case when draft.kind = 'image' then nullif(trim(entry.image_path), '') else null end,
    image_alt = case when draft.kind = 'image' then trim(entry.image_alt) else null end,
    focal_x = case when draft.kind = 'image' then entry.focal_x else draft.focal_x end,
    focal_y = case when draft.kind = 'image' then entry.focal_y else draft.focal_y end,
    surface_preset = case when draft.kind = 'image' then entry.surface_preset else draft.surface_preset end,
    overlay_preset = case when draft.kind = 'image' then entry.overlay_preset else draft.overlay_preset end,
    enabled = case when draft.kind = 'image' then nullif(trim(entry.image_path), '') is not null or draft.value <> '' else true end,
    updated_by = auth.uid(),
    updated_at = saved_at
  from jsonb_to_recordset(p_entries) as entry(
    key text, value text, image_path text, image_alt text,
    focal_x smallint, focal_y smallint, surface_preset text, overlay_preset text
  )
  where draft.key = entry.key and draft.section = p_section;

  return saved_at;
end;
$$;

create or replace function public.publish_site_content_section(
  p_section public.site_content_section
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  revision_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  perform 1 from public.site_content where section = p_section for update;

  insert into public.site_content_revisions(section, snapshot, reason, created_by)
  select p_section, jsonb_agg(to_jsonb(content) order by content.display_order), 'publish', auth.uid()
  from public.site_content as content where content.section = p_section
  returning id into revision_id;

  update public.site_content as published set
    value = draft.value,
    image_path = draft.image_path,
    image_alt = draft.image_alt,
    focal_x = draft.focal_x,
    focal_y = draft.focal_y,
    presentation = draft.presentation,
    surface_preset = draft.surface_preset,
    overlay_preset = draft.overlay_preset,
    enabled = draft.enabled,
    updated_by = auth.uid()
  from public.site_content_drafts as draft
  where published.key = draft.key and published.section = p_section;

  return revision_id;
end;
$$;

create or replace function public.restore_site_content_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.site_content_revisions%rowtype;
  rollback_revision_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into selected from public.site_content_revisions where id = p_revision_id;
  if not found then raise exception 'revision_not_found' using errcode = 'P0002'; end if;

  perform 1 from public.site_content where section = selected.section for update;

  insert into public.site_content_revisions(section, snapshot, reason, created_by)
  select selected.section, jsonb_agg(to_jsonb(content) order by content.display_order), 'restore', auth.uid()
  from public.site_content as content where content.section = selected.section
  returning id into rollback_revision_id;

  update public.site_content as published set
    value = snapshot.value,
    image_path = snapshot.image_path,
    image_alt = snapshot.image_alt,
    focal_x = snapshot.focal_x,
    focal_y = snapshot.focal_y,
    presentation = snapshot.presentation,
    surface_preset = snapshot.surface_preset,
    overlay_preset = snapshot.overlay_preset,
    enabled = snapshot.enabled,
    updated_by = auth.uid()
  from jsonb_to_recordset(selected.snapshot) as snapshot(
    key text, value text, image_path text, image_alt text,
    focal_x smallint, focal_y smallint, presentation text,
    surface_preset text, overlay_preset text, enabled boolean
  )
  where published.key = snapshot.key and published.section = selected.section;

  update public.site_content_drafts as draft set
    value = published.value,
    image_path = published.image_path,
    image_alt = published.image_alt,
    focal_x = published.focal_x,
    focal_y = published.focal_y,
    presentation = published.presentation,
    surface_preset = published.surface_preset,
    overlay_preset = published.overlay_preset,
    enabled = published.enabled,
    updated_by = auth.uid()
  from public.site_content as published
  where draft.key = published.key and published.section = selected.section;

  return rollback_revision_id;
end;
$$;

revoke all on function public.save_site_content_draft(public.site_content_section, jsonb) from public;
revoke all on function public.publish_site_content_section(public.site_content_section) from public;
revoke all on function public.restore_site_content_revision(uuid) from public;
grant execute on function public.save_site_content_draft(public.site_content_section, jsonb) to authenticated;
grant execute on function public.publish_site_content_section(public.site_content_section) to authenticated;
grant execute on function public.restore_site_content_revision(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content-media-ingest', 'site-content-media-ingest', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_content_media_manager_insert on storage.objects;
create policy site_content_media_manager_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-content-media' and public.is_admin());

create policy site_content_ingest_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'site-content-media-ingest' and public.is_admin() and (storage.foldername(name))[1] = auth.uid()::text);
create policy site_content_ingest_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-content-media-ingest' and public.is_admin() and (storage.foldername(name))[1] = auth.uid()::text);
create policy site_content_ingest_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-content-media-ingest' and public.is_admin() and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.site_content_drafts is
  'One fixed draft row per approved content key. Managers cannot create or delete rows.';
comment on table public.site_content_revisions is
  'Immutable published snapshots used for audited rollback without losing referenced media.';
