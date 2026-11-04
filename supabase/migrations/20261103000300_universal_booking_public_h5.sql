-- H5: public read access for the neutral configurable catalog.
-- This only replaces the three policies introduced by H2. Historical tables,
-- policies and booking functions remain untouched.

create function public.is_public_configured_treatment(requested_treatment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.treatments as treatment
    where treatment.id = requested_treatment_id
      and treatment.is_active
      and treatment.config_enabled
  );
$function$;

revoke all on function public.is_public_configured_treatment(uuid)
  from public, anon, authenticated;
grant execute on function public.is_public_configured_treatment(uuid)
  to anon, authenticated;

drop policy treatment_options_public_read on public.treatment_options;
create policy treatment_options_public_read
  on public.treatment_options
  for select to anon, authenticated
  using (
    is_active
    and price_cents > 0
    and public.is_public_configured_treatment(treatment_id)
  );

drop policy treatment_option_combos_public_read on public.treatment_option_combos;
create policy treatment_option_combos_public_read
  on public.treatment_option_combos
  for select to anon, authenticated
  using (
    is_active
    and price_cents > 0
    and public.is_public_configured_treatment(treatment_id)
  );

drop policy treatment_option_combo_items_public_read on public.treatment_option_combo_items;
create policy treatment_option_combo_items_public_read
  on public.treatment_option_combo_items
  for select to anon, authenticated
  using (
    public.is_public_configured_treatment(treatment_id)
    and exists (
      select 1
      from public.treatment_option_combos as combo
      where combo.id = treatment_option_combo_items.combo_id
        and combo.treatment_id = treatment_option_combo_items.treatment_id
        and combo.is_active
        and combo.price_cents > 0
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
