-- Restore atomic booking status transitions after direct history writes were revoked.
--
-- `transition_admin_booking` already validates the authenticated actor with
-- `public.is_admin(auth.uid())`, locks the booking row, validates the state
-- transition and writes both the booking and its audit history atomically.
-- Making only this function SECURITY DEFINER lets that audited operation write
-- its history without restoring direct INSERT access to authenticated users.

alter function public.transition_admin_booking(
  uuid,
  public.booking_status,
  text
) security definer;

revoke all on function public.transition_admin_booking(
  uuid,
  public.booking_status,
  text
) from public, anon;

grant execute on function public.transition_admin_booking(
  uuid,
  public.booking_status,
  text
) to authenticated;

-- Rollback (do not run after valid production transitions without first
-- restoring a safe history-write mechanism):
-- alter function public.transition_admin_booking(uuid, public.booking_status, text) security invoker;
