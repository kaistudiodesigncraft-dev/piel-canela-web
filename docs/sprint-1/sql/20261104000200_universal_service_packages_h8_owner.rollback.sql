begin;

grant service_package_rpc_executor to postgres;
alter function public.suggest_service_package_outcome(uuid,uuid,text,timestamptz) owner to postgres;
alter function public.register_service_package_purchase(uuid,text,uuid) owner to postgres;
alter function public.get_available_slots_for_service_package(uuid,date,uuid) owner to postgres;
alter function public.manage_service_package_session(uuid,text,uuid,uuid,timestamptz,timestamptz,text) owner to postgres;
alter function public.extend_service_package_validity(uuid,integer,text,uuid) owner to postgres;
revoke service_package_rpc_executor from postgres;

drop policy audit_log_package_rpc_insert on public.audit_log;
drop policy booking_status_history_package_rpc_insert on public.booking_status_history;
drop policy service_package_operations_rpc_insert on public.service_package_operations;
drop policy service_package_sessions_rpc_write on public.service_package_sessions;
drop policy service_package_contracts_rpc_write on public.service_package_contracts;

revoke all privileges on sequence public.booking_status_history_id_seq,
  public.audit_log_id_seq from service_package_rpc_executor;
revoke all privileges on public.treatments, public.treatment_option_combos,
  public.business_settings, public.bookings, public.service_package_contracts,
  public.service_package_sessions, public.service_package_operations,
  public.booking_status_history, public.audit_log
  from service_package_rpc_executor;
revoke all privileges on function public.is_admin(uuid),
  private.service_package_rules_valid(jsonb),
  private.service_package_balance(uuid),
  private.suggest_service_package_outcome(jsonb,timestamptz,text,timestamptz),
  private.find_booking_professional(uuid,timestamptz,timestamptz,uuid,uuid),
  private.get_snapshot_slots(uuid,uuid,date,integer,integer,uuid,uuid,timestamptz)
  from service_package_rpc_executor;
revoke usage on schema public, private from service_package_rpc_executor;
revoke authenticated from service_package_rpc_executor;
drop role service_package_rpc_executor;

commit;
