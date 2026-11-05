-- H8 local rollback rehearsal. Run only while H8 has no production data.
begin;

drop function public.extend_service_package_validity(uuid,integer,text,uuid);
drop function public.manage_service_package_session(uuid,text,uuid,uuid,timestamptz,timestamptz,text);
drop function public.get_available_slots_for_service_package(uuid,date,uuid);
drop function public.register_service_package_purchase(uuid,text,uuid);
drop function public.suggest_service_package_outcome(uuid,uuid,text,timestamptz);
drop function private.suggest_service_package_outcome(jsonb,timestamptz,text,timestamptz);
drop function private.service_package_balance(uuid);

alter table public.bookings drop column service_package_id;
drop table public.service_package_operations;
drop table public.service_package_sessions;
drop table public.service_package_contracts;

alter table public.business_settings
  drop constraint business_settings_default_deposit_percent,
  drop column default_deposit_percent;

alter table public.treatment_option_combos
  drop constraint treatment_option_combos_active_package_rules,
  drop constraint treatment_option_combos_package_rules_scope,
  drop constraint treatment_option_combos_package_rules_shape,
  drop constraint treatment_option_combos_package_rules_version,
  drop column package_rules_version,
  drop column package_rules;

drop function private.service_package_rules_valid(jsonb);

commit;
