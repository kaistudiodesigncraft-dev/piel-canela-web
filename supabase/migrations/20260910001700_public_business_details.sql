-- Public information supplied by the agency. No existing rows are rewritten.
-- Existing admin/manager RLS and business_settings_audit trigger remain in force.
alter table public.business_settings
  add column if not exists reception_hours text,
  add column if not exists privacy_responsible text,
  add column if not exists privacy_contact_email text,
  add column if not exists no_show_policy text,
  add column if not exists package_policy text;

alter table public.business_settings
  add constraint business_settings_reception_hours_valid
    check (reception_hours is null or (char_length(reception_hours) <= 500 and reception_hours !~ '[<>]')),
  add constraint business_settings_privacy_responsible_valid
    check (privacy_responsible is null or (char_length(privacy_responsible) <= 200 and privacy_responsible !~ '[<>]')),
  add constraint business_settings_privacy_contact_email_valid
    check (privacy_contact_email is null or (char_length(privacy_contact_email) <= 180 and privacy_contact_email ~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$')),
  add constraint business_settings_no_show_policy_valid
    check (no_show_policy is null or (char_length(no_show_policy) <= 2000 and no_show_policy !~ '[<>]')),
  add constraint business_settings_package_policy_valid
    check (package_policy is null or (char_length(package_policy) <= 2000 and package_policy !~ '[<>]'));

grant select (reception_hours, privacy_responsible, privacy_contact_email, no_show_policy, package_policy)
  on public.business_settings to anon, authenticated;
grant update (reception_hours, privacy_responsible, privacy_contact_email, no_show_policy, package_policy)
  on public.business_settings to authenticated;

comment on column public.business_settings.reception_hours is 'Public reception hours only; never used to calculate booking availability.';
comment on column public.business_settings.package_policy is 'Agency-authored public conditions; does not change contractual package snapshots.';
