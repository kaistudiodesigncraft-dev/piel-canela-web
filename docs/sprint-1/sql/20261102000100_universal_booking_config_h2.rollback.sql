-- Local rollback rehearsal for H2.
-- This removes only objects introduced by 20261102000100. It must not be used
-- after real generic catalog data has been created without a reviewed export.

begin;

drop table if exists public.treatment_option_combo_items;
drop table if exists public.treatment_option_combos;
drop table if exists public.treatment_options;

alter table public.treatments
  drop constraint if exists treatments_enabled_config_required,
  drop constraint if exists treatments_booking_config_shape,
  drop column if exists config_enabled,
  drop column if exists booking_config;

commit;
