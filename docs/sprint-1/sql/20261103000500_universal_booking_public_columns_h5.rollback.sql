-- Rollback for H5 treatment column privileges.

revoke select (booking_config, config_enabled)
on table public.treatments
from anon;
