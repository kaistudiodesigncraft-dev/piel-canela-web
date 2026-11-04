-- Roll back H5 to the exact H2 public-policy definitions.

drop policy treatment_options_public_read on public.treatment_options;
create policy treatment_options_public_read
  on public.treatment_options
  for select to anon
  using (
    is_active
    and price_cents > 0
    and exists (
      select 1
      from public.treatments as treatment
      where treatment.id = treatment_options.treatment_id
        and treatment.is_active
        and treatment.config_enabled
    )
  );

drop policy treatment_option_combos_public_read on public.treatment_option_combos;
create policy treatment_option_combos_public_read
  on public.treatment_option_combos
  for select to anon
  using (
    is_active
    and price_cents > 0
    and exists (
      select 1
      from public.treatments as treatment
      where treatment.id = treatment_option_combos.treatment_id
        and treatment.is_active
        and treatment.config_enabled
    )
  );

drop policy treatment_option_combo_items_public_read on public.treatment_option_combo_items;
create policy treatment_option_combo_items_public_read
  on public.treatment_option_combo_items
  for select to anon
  using (
    exists (
      select 1
      from public.treatment_option_combos as combo
      join public.treatments as treatment on treatment.id = combo.treatment_id
      where combo.id = treatment_option_combo_items.combo_id
        and combo.treatment_id = treatment_option_combo_items.treatment_id
        and combo.is_active
        and combo.price_cents > 0
        and treatment.is_active
        and treatment.config_enabled
    )
    and exists (
      select 1
      from public.treatment_options as option
      where option.id = treatment_option_combo_items.option_id
        and option.treatment_id = treatment_option_combo_items.treatment_id
        and option.is_active
        and option.price_cents > 0
    )
  );

revoke all on function public.is_public_configured_treatment(uuid)
  from public, anon, authenticated;
drop function public.is_public_configured_treatment(uuid);
