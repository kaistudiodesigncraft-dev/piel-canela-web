-- The mixed selection mode was added to booking RPCs but not to the original
-- public SELECT policy. Keep the existing publication/feature gates and make
-- both configurable modes readable. No catalog or booking rows are changed.
begin;

alter policy treatment_combos_public_read on public.treatment_combos
  using (
    is_active and exists (
      select 1
      from public.treatments treatment
      cross join public.business_settings settings
      where treatment.id = treatment_combos.treatment_id
        and treatment.is_active
        and treatment.selection_mode in ('closed_combo', 'combo_with_extras')
        and settings.singleton
        and settings.depilation_combos_enabled
    )
  );

commit;
