\set ON_ERROR_STOP on
do $verify$
declare
  consuming integer;
  operations integer;
  successes integer;
  exhausted integer;
begin
  select count(*) into consuming from public.service_package_sessions
  where package_id='88100000-0000-4000-8000-000000000005'
    and status in ('reserved','completed','lost');
  select count(*) into operations from public.service_package_operations
  where package_id='88100000-0000-4000-8000-000000000005' and operation='reserve';
  select count(*) filter(where outcome='success'),
    count(*) filter(where outcome='package_has_no_sessions')
  into successes,exhausted from public.h8_concurrency_results;
  if consuming <> 2 or operations <> 1 or successes <> 1 or exhausted <> 1
    or private.service_package_balance('88100000-0000-4000-8000-000000000005') <> 0 then
    raise exception 'h8_concurrency_invariant_failed consuming=% operations=% success=% exhausted=%',
      consuming,operations,successes,exhausted;
  end if;
end;
$verify$;

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
delete from public.bookings where id in (
  '88100000-0000-4000-8000-000000000003',
  '88100000-0000-4000-8000-000000000007',
  '88100000-0000-4000-8000-000000000008'
) or idempotency_key in (
  '88100000-0000-4000-8000-000000000007',
  '88100000-0000-4000-8000-000000000008'
);
delete from public.professional_availability_exceptions where reason='H8 concurrency';
delete from public.availability_exceptions where internal_reason='H8 concurrency';
delete from public.treatment_professionals where professional_id='88100000-0000-4000-8000-000000000009';
delete from public.professionals where id='88100000-0000-4000-8000-000000000009';
delete from public.customers where id='88100000-0000-4000-8000-000000000002';
delete from public.treatment_option_combos where id='88100000-0000-4000-8000-000000000001';

alter table public.treatments disable trigger treatments_enforce_configured_readiness;
alter table public.treatments disable trigger treatments_updated_at;
update public.treatments treatment set
  booking_config=restore.booking_config,
  config_enabled=restore.config_enabled,
  updated_at=restore.updated_at
from private.h8_concurrency_restore restore
where treatment.id=restore.treatment_id;
alter table public.treatments enable trigger treatments_updated_at;
alter table public.treatments enable trigger treatments_enforce_configured_readiness;
drop table private.h8_concurrency_restore;
drop table public.h8_concurrency_results;
