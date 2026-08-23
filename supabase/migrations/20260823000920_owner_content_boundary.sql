-- Sprint 5 urgent: institutional content belongs to Kai Studio ownership.
-- Managers retain day-to-day operational access through public.is_admin(), while
-- content mutations and their media require the narrower public.is_owner().

drop policy if exists site_content_admin_update on public.site_content;
drop policy if exists site_content_owner_update on public.site_content;
create policy site_content_owner_update on public.site_content
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists site_content_media_admin_insert on storage.objects;
drop policy if exists site_content_media_admin_update on storage.objects;
drop policy if exists site_content_media_admin_delete on storage.objects;
drop policy if exists site_content_media_owner_insert on storage.objects;
drop policy if exists site_content_media_owner_update on storage.objects;
drop policy if exists site_content_media_owner_delete on storage.objects;

create policy site_content_media_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'site-content-media'
    and public.is_owner()
  );

create policy site_content_media_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'site-content-media'
    and public.is_owner()
  )
  with check (
    bucket_id = 'site-content-media'
    and public.is_owner()
  );

create policy site_content_media_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'site-content-media'
    and public.is_owner()
  );

comment on policy site_content_owner_update on public.site_content is
  'Only the Kai Studio owner role may change institutional copy or image references.';

