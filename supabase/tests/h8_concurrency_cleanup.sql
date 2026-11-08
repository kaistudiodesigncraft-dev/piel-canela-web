\set ON_ERROR_STOP on
delete from public.audit_log
where (table_name='service_package_contracts' and record_id='88100000-0000-4000-8000-000000000005')
   or (table_name='service_package_sessions' and record_id in (
     select id from public.service_package_sessions where package_id='88100000-0000-4000-8000-000000000005'
   ))
   or (table_name='bookings' and record_id in (
     select id from public.bookings where service_package_id='88100000-0000-4000-8000-000000000005'
   ));
delete from public.service_package_operations where package_id='88100000-0000-4000-8000-000000000005';
delete from public.service_package_sessions where package_id='88100000-0000-4000-8000-000000000005';
update public.bookings set service_package_id=null where service_package_id='88100000-0000-4000-8000-000000000005';
delete from public.service_package_contracts where id='88100000-0000-4000-8000-000000000005';
delete from public.bookings where id='88100000-0000-4000-8000-000000000003'
  or idempotency_key in ('88100000-0000-4000-8000-000000000007','88100000-0000-4000-8000-000000000008');
delete from public.professional_availability_exceptions where reason='H8 concurrency';
delete from public.availability_exceptions where internal_reason='H8 concurrency';
delete from public.treatment_professionals where professional_id='88100000-0000-4000-8000-000000000009';
delete from public.professional_specialties where professional_id='88100000-0000-4000-8000-000000000009';
delete from public.professionals where id='88100000-0000-4000-8000-000000000009';
delete from public.customers where id='88100000-0000-4000-8000-000000000002';
delete from public.treatment_option_combos where id='88100000-0000-4000-8000-000000000001';
alter table public.treatments disable trigger treatments_enforce_configured_readiness;
alter table public.treatments disable trigger treatments_updated_at;
update public.treatments treatment set booking_config=restore.booking_config,config_enabled=restore.config_enabled,is_active=restore.is_active,updated_at=restore.updated_at
from private.h8_concurrency_restore restore where treatment.id=restore.treatment_id;
alter table public.treatments enable trigger treatments_updated_at;
alter table public.treatments enable trigger treatments_enforce_configured_readiness;
delete from public.treatments
where id='e6926fc8-f910-4b26-8c4b-53a9d27be7b7'
  and (select treatment_created from private.h8_concurrency_fixture where singleton);
delete from public.specialties
where id='88100000-0000-4000-8000-000000000091'
  and (select treatment_created from private.h8_concurrency_fixture where singleton);
delete from public.treatment_categories
where id='88100000-0000-4000-8000-000000000090'
  and (select treatment_created from private.h8_concurrency_fixture where singleton);
delete from auth.users where id='88100000-0000-4000-8000-000000000098';
drop table private.h8_concurrency_restore;
drop table private.h8_concurrency_fixture;
drop table if exists public.h8_concurrency_results;
