-- Restore the explicit table grant expected by the existing public RLS policy.
-- This is additive and does not mutate any published or draft content.

grant select on public.site_content to anon, authenticated;
