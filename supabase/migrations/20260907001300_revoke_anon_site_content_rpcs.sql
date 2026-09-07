-- Restrict institutional content mutations to authenticated operators.
-- These RPCs also validate the caller internally, but anonymous EXECUTE
-- privileges are unnecessary and increase the exposed attack surface.

revoke all on function public.save_site_content_draft(
  public.site_content_section,
  jsonb
) from public, anon;

revoke all on function public.publish_site_content_section(
  public.site_content_section
) from public, anon;

revoke all on function public.restore_site_content_revision(
  uuid
) from public, anon;

grant execute on function public.save_site_content_draft(
  public.site_content_section,
  jsonb
) to authenticated;

grant execute on function public.publish_site_content_section(
  public.site_content_section
) to authenticated;

grant execute on function public.restore_site_content_revision(
  uuid
) to authenticated;
