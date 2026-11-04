-- H4 rollback. Safe only after pausing use of the H4 editor.
drop function if exists public.save_treatment_option_combo_v1(
  uuid, uuid, text, text, text, integer, integer, integer, integer,
  boolean, uuid[], uuid[], timestamptz
);
drop trigger if exists treatments_enforce_configured_readiness on public.treatments;
drop function if exists public.enforce_configured_treatment_readiness();
drop trigger if exists treatment_options_protect_active_usage on public.treatment_options;
drop function if exists public.protect_active_treatment_option_usage();
