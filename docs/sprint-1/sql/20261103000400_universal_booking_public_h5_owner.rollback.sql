-- Roll back H5 least-privilege ownership hardening.

grant booking_catalog_policy_reader to postgres;
alter function public.is_public_configured_treatment(uuid)
  owner to postgres;
revoke booking_catalog_policy_reader from postgres;

drop policy treatments_booking_catalog_policy_reader
  on public.treatments;

revoke select (id, is_active, config_enabled)
  on public.treatments
  from booking_catalog_policy_reader;
revoke usage on schema public from booking_catalog_policy_reader;
drop role booking_catalog_policy_reader;
