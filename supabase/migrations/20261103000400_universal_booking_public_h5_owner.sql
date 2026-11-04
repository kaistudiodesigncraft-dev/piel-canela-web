-- H5 hardening: the SECURITY DEFINER catalog predicate must not be owned by
-- postgres. The dedicated role cannot log in, bypass RLS or access any data
-- beyond the three treatment columns required by the boolean predicate.

do $block$
begin
  if not exists (select 1 from pg_roles where rolname = 'booking_catalog_policy_reader') then
    create role booking_catalog_policy_reader
      nologin
      noinherit
      nosuperuser
      nocreatedb
      nocreaterole
      noreplication
      nobypassrls;
  end if;
end;
$block$;

grant usage on schema public to booking_catalog_policy_reader;
grant select (id, is_active, config_enabled)
  on public.treatments
  to booking_catalog_policy_reader;

create policy treatments_booking_catalog_policy_reader
  on public.treatments
  for select
  to booking_catalog_policy_reader
  using (is_active and config_enabled);

-- PostgreSQL requires the migration executor to be a member of the new owner
-- only for the ownership transfer. The membership is removed immediately.
grant booking_catalog_policy_reader to postgres;
grant create on schema public to booking_catalog_policy_reader;
alter function public.is_public_configured_treatment(uuid)
  owner to booking_catalog_policy_reader;
revoke create on schema public from booking_catalog_policy_reader;
revoke booking_catalog_policy_reader from postgres;

revoke all on function public.is_public_configured_treatment(uuid)
  from public, anon, authenticated;
grant execute on function public.is_public_configured_treatment(uuid)
  to anon, authenticated;
