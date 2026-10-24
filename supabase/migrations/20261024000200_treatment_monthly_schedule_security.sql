-- Trigger functions are invoked by PostgreSQL itself and must not be callable
-- through the public API. This migration changes privileges only.
begin;

revoke all on function public.enforce_treatment_service_date() from public;
revoke all on function public.enforce_treatment_service_date() from anon;
revoke all on function public.enforce_treatment_service_date() from authenticated;

commit;

-- Rollback (only if direct execution is intentionally required):
-- grant execute on function public.enforce_treatment_service_date() to authenticated;
