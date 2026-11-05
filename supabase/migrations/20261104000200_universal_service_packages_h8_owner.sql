-- H8 least-privilege owner for package RPCs. The role cannot log in or bypass
-- RLS and has only the catalog/session privileges needed by the five RPCs.

begin;

do $block$
begin
  if not exists (select 1 from pg_roles where rolname='service_package_rpc_executor') then
    create role service_package_rpc_executor
      nologin inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end;
$block$;

grant authenticated to service_package_rpc_executor;
grant usage on schema public, private to service_package_rpc_executor;

grant select on public.treatments, public.treatment_option_combos,
  public.business_settings, public.bookings, public.service_package_contracts,
  public.service_package_sessions, public.service_package_operations
  to service_package_rpc_executor;
grant insert, update on public.bookings, public.service_package_contracts,
  public.service_package_sessions
  to service_package_rpc_executor;
grant insert on public.service_package_operations, public.booking_status_history,
  public.audit_log
  to service_package_rpc_executor;
grant usage on sequence public.booking_status_history_id_seq,
  public.audit_log_id_seq
  to service_package_rpc_executor;

grant execute on function public.is_admin(uuid),
  private.service_package_rules_valid(jsonb),
  private.service_package_balance(uuid),
  private.suggest_service_package_outcome(jsonb,timestamptz,text,timestamptz),
  private.find_booking_professional(uuid,timestamptz,timestamptz,uuid,uuid),
  private.get_snapshot_slots(uuid,uuid,date,integer,integer,uuid,uuid,timestamptz)
  to service_package_rpc_executor;

create policy service_package_contracts_rpc_write
  on public.service_package_contracts for all to service_package_rpc_executor
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy service_package_sessions_rpc_write
  on public.service_package_sessions for all to service_package_rpc_executor
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy service_package_operations_rpc_insert
  on public.service_package_operations for insert to service_package_rpc_executor
  with check (public.is_admin(auth.uid()));
create policy booking_status_history_package_rpc_insert
  on public.booking_status_history for insert to service_package_rpc_executor
  with check (public.is_admin(auth.uid()));
create policy audit_log_package_rpc_insert
  on public.audit_log for insert to service_package_rpc_executor
  with check (public.is_admin(auth.uid()));

grant service_package_rpc_executor to postgres;
grant create on schema public to service_package_rpc_executor;
alter function public.suggest_service_package_outcome(uuid,uuid,text,timestamptz)
  owner to service_package_rpc_executor;
alter function public.register_service_package_purchase(uuid,text,uuid)
  owner to service_package_rpc_executor;
alter function public.get_available_slots_for_service_package(uuid,date,uuid)
  owner to service_package_rpc_executor;
alter function public.manage_service_package_session(uuid,text,uuid,uuid,timestamptz,timestamptz,text)
  owner to service_package_rpc_executor;
alter function public.extend_service_package_validity(uuid,integer,text,uuid)
  owner to service_package_rpc_executor;
revoke create on schema public from service_package_rpc_executor;
revoke service_package_rpc_executor from postgres;

commit;
