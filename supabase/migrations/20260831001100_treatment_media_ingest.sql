-- Additive, private ingest pipeline for treatment media.
-- Existing treatments and public media remain untouched.

create table if not exists public.treatment_media_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  treatment_id uuid not null,
  ingest_path text not null unique,
  final_path text unique,
  status text not null default 'pending'
    check (status in ('pending', 'uploaded', 'finalized', 'failed')),
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  failure_code text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  finalized_at timestamptz,
  constraint treatment_media_uploads_dimensions_check check (
    (width is null and height is null)
    or (width is not null and width > 0 and height is not null and height > 0)
  )
);

create index if not exists treatment_media_uploads_user_created_idx
  on public.treatment_media_uploads(user_id, created_at desc);
create index if not exists treatment_media_uploads_treatment_idx
  on public.treatment_media_uploads(treatment_id, status);

alter table public.treatment_media_uploads enable row level security;
revoke all on public.treatment_media_uploads from anon, authenticated;
grant select, insert, update on public.treatment_media_uploads to authenticated;

drop policy if exists treatment_media_uploads_admin_select on public.treatment_media_uploads;
drop policy if exists treatment_media_uploads_admin_insert on public.treatment_media_uploads;
drop policy if exists treatment_media_uploads_admin_update on public.treatment_media_uploads;

create policy treatment_media_uploads_admin_select
  on public.treatment_media_uploads for select to authenticated
  using (public.is_admin() and user_id = auth.uid());

create policy treatment_media_uploads_admin_insert
  on public.treatment_media_uploads for insert to authenticated
  with check (public.is_admin() and user_id = auth.uid());

create policy treatment_media_uploads_admin_update
  on public.treatment_media_uploads for update to authenticated
  using (public.is_admin() and user_id = auth.uid())
  with check (public.is_admin() and user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'treatment-media-ingest',
  'treatment-media-ingest',
  false,
  4194304,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists treatment_media_ingest_admin_select on storage.objects;
drop policy if exists treatment_media_ingest_admin_insert on storage.objects;
drop policy if exists treatment_media_ingest_admin_delete on storage.objects;

create policy treatment_media_ingest_admin_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'treatment-media-ingest'
    and public.is_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy treatment_media_ingest_admin_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'treatment-media-ingest'
    and public.is_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy treatment_media_ingest_admin_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'treatment-media-ingest'
    and public.is_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.treatment_media_uploads is
  'Short-lived, authenticated treatment image uploads. It never replaces treatment records automatically.';
