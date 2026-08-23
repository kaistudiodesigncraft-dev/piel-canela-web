-- Sprint 5: public operating terms and deterministic pending-booking expiry.

alter type public.admin_role add value if not exists 'manager';

grant select (
  singleton,
  whatsapp_number,
  address,
  public_email,
  instagram_url,
  deposit_text,
  cancellation_policy
) on public.business_settings to anon;

-- The public availability RPC already expires stale pending rows. pg_cron keeps
-- administrative state accurate even during periods without public traffic.
create extension if not exists pg_cron with schema pg_catalog;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'piel-canela-expire-pending-bookings';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'piel-canela-expire-pending-bookings',
    '*/5 * * * *',
    'select public.expire_pending_bookings();'
  );
end;
$$;
