-- H5 hardening: the production catalog exposes treatments to anon through
-- column-level privileges. Grant only the two additive H2 columns required by
-- the guarded public loader; existing rows remain protected by treatments RLS.

grant select (booking_config, config_enabled)
on table public.treatments
to anon;
