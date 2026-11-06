-- H10: enable the already-modeled universal package mode after H8/H9 acceptance.
-- This only evolves the neutral H4 readiness guard; legacy flows remain untouched.

create or replace function public.enforce_configured_treatment_readiness()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  selected_mode text;
  allow_loose boolean;
  allow_combos boolean;
  active_options integer;
  active_combos integer;
  active_packages integer;
begin
  if new.config_enabled is distinct from true then return new; end if;
  if new.booking_config is null or new.booking_config->>'version' is distinct from '1' then
    raise exception using errcode = '23514', message = 'booking_config_invalid';
  end if;
  selected_mode := new.booking_config->>'mode';
  allow_loose := coalesce((new.booking_config->>'allowLooseOptions')::boolean, false);
  allow_combos := coalesce((new.booking_config->>'allowCombos')::boolean, false);
  if selected_mode not in ('simple', 'options', 'closed_combos', 'combos_with_addons', 'package') then
    raise exception using errcode = '23514', message = 'booking_config_invalid';
  end if;

  select count(*) into active_options
  from public.treatment_options
  where treatment_id = new.id and is_active and price_cents > 0;
  select count(*) into active_combos
  from public.treatment_option_combos
  where treatment_id = new.id and is_active and price_cents > 0 and kind = 'combo';
  select count(*) into active_packages
  from public.treatment_option_combos
  where treatment_id = new.id and is_active and price_cents > 0 and kind = 'package';

  if selected_mode = 'simple' and (active_options > 0 or active_combos > 0 or active_packages > 0) then
    raise exception using errcode = '23514', message = 'simple_config_has_active_catalog';
  elsif selected_mode = 'options' and active_options = 0 then
    raise exception using errcode = '23514', message = 'options_config_requires_active_option';
  elsif selected_mode = 'options' and not allow_combos and active_combos > 0 then
    raise exception using errcode = '23514', message = 'options_config_disallows_active_combinations';
  elsif selected_mode = 'closed_combos' and active_combos = 0 then
    raise exception using errcode = '23514', message = 'closed_combos_requires_active_combination';
  elsif selected_mode = 'combos_with_addons'
    and active_combos = 0
    and (not allow_loose or active_options = 0) then
    raise exception using errcode = '23514', message = 'combos_config_requires_public_selection';
  elsif selected_mode = 'package' and active_packages = 0 then
    raise exception using errcode = '23514', message = 'package_config_requires_active_package';
  elsif selected_mode = 'package' and (active_options > 0 or active_combos > 0) then
    raise exception using errcode = '23514', message = 'package_config_has_incompatible_catalog';
  end if;

  if selected_mode <> 'package' and active_packages > 0 then
    raise exception using errcode = '23514', message = 'active_combination_kind_mismatch';
  end if;
  if selected_mode <> 'combos_with_addons' and exists (
    select 1
    from public.treatment_option_combo_items as item
    join public.treatment_option_combos as combo on combo.id = item.combo_id
    where item.treatment_id = new.id and item.role = 'addon' and combo.is_active
  ) then
    raise exception using errcode = '23514', message = 'active_addons_not_allowed_for_mode';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_configured_treatment_readiness()
  from public, anon, authenticated;

-- H3 kept package mode deliberately closed. H10 opens only that neutral mode,
-- while preserving the same signature, grants and every legacy booking RPC.
create or replace function public.get_booking_order_context_v2(
  requested_treatment_id uuid,
  requested_combination_id uuid default null,
  requested_option_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  selected_treatment public.treatments%rowtype;
  selected_combination public.treatment_option_combos%rowtype;
  selected_options jsonb := '[]'::jsonb;
  selected_option_versions jsonb := '[]'::jsonb;
  included_options jsonb := '[]'::jsonb;
  included_option_ids jsonb := '[]'::jsonb;
  allowed_addon_ids jsonb := '[]'::jsonb;
  relation_versions jsonb := '[]'::jsonb;
  combination_payload jsonb;
  context_payload jsonb;
  selected_mode text;
begin
  if requested_treatment_id is null
    or requested_option_ids is null
    or cardinality(requested_option_ids) > 100
    or cardinality(requested_option_ids) <> (
      select count(distinct option_id) from unnest(requested_option_ids) as option_id
    ) then
    raise exception using errcode = '22023', message = 'invalid_options';
  end if;

  select * into selected_treatment
  from public.treatments treatment
  where treatment.id = requested_treatment_id
    and treatment.is_active;

  if selected_treatment.id is null then
    raise exception using errcode = '22023', message = 'treatment_not_available';
  end if;
  if selected_treatment.config_enabled is distinct from true then
    raise exception using errcode = '22023', message = 'legacy_flow_required';
  end if;
  if selected_treatment.booking_config is null
    or selected_treatment.booking_config->>'version' is distinct from '1' then
    raise exception using errcode = '22023', message = 'booking_config_invalid';
  end if;
  selected_mode := selected_treatment.booking_config->>'mode';
  if selected_mode = 'package'
    and (requested_combination_id is null or cardinality(requested_option_ids) <> 0) then
    raise exception using errcode = '22023', message = 'package_selection_invalid';
  end if;
  if not exists (
    select 1 from public.specialties specialty
    where specialty.id = selected_treatment.specialty_id and specialty.is_active
  ) or not exists (
    select 1 from public.treatment_categories category
    where category.id = selected_treatment.category_id and category.is_active
  ) then
    raise exception using errcode = '22023', message = 'treatment_not_available';
  end if;

  if requested_combination_id is not null then
    select * into selected_combination
    from public.treatment_option_combos combination
    where combination.id = requested_combination_id
      and combination.treatment_id = selected_treatment.id
      and combination.is_active
      and combination.price_cents > 0
      and combination.kind = case when selected_mode = 'package' then 'package' else 'combo' end;
    if selected_combination.id is null then
      raise exception using errcode = '22023', message = 'combination_unavailable';
    end if;

    if exists (
      select 1
      from public.treatment_option_combo_items item
      join public.treatment_options option on option.id = item.option_id
      where item.combo_id = selected_combination.id
        and item.treatment_id = selected_treatment.id
        and (not option.is_active or option.price_cents <= 0)
    ) then
      raise exception using errcode = '22023', message = 'combination_unavailable';
    end if;

    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', option.id,
          'name', option.name,
          'priceCents', option.price_cents,
          'durationMinutes', option.duration_minutes
        ) order by item.display_order, option.name, option.id
      ) filter (where item.role = 'included'), '[]'::jsonb),
      coalesce(jsonb_agg(to_jsonb(option.id) order by item.display_order, option.name, option.id)
        filter (where item.role = 'included'), '[]'::jsonb),
      coalesce(jsonb_agg(to_jsonb(option.id) order by item.display_order, option.name, option.id)
        filter (where item.role = 'addon'), '[]'::jsonb),
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'optionId', item.option_id,
          'role', item.role,
          'updatedAt', item.updated_at,
          'optionUpdatedAt', option.updated_at
        ) order by item.id
      ), '[]'::jsonb)
    into included_options, included_option_ids, allowed_addon_ids, relation_versions
    from public.treatment_option_combo_items item
    join public.treatment_options option on option.id = item.option_id
    where item.combo_id = selected_combination.id
      and item.treatment_id = selected_treatment.id;

    combination_payload := jsonb_build_object(
      'id', selected_combination.id,
      'name', selected_combination.name,
      'kind', selected_combination.kind,
      'priceCents', selected_combination.price_cents,
      'durationMinutes', selected_combination.duration_minutes,
      'includedOptionIds', included_option_ids,
      'allowedAddonOptionIds', allowed_addon_ids,
      'sessionCount', selected_combination.session_count
    );
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', option.id,
        'name', option.name,
        'priceCents', option.price_cents,
        'durationMinutes', option.duration_minutes,
        'displayOrder', option.display_order,
        'isActive', option.is_active
      ) order by option.id
    ), '[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object('id', option.id, 'updatedAt', option.updated_at)
      order by option.id
    ), '[]'::jsonb)
  into selected_options, selected_option_versions
  from public.treatment_options option
  where option.id = any(requested_option_ids)
    and option.treatment_id = selected_treatment.id
    and option.is_active
    and option.price_cents > 0;

  if jsonb_array_length(selected_options) <> cardinality(requested_option_ids) then
    raise exception using errcode = '22023', message = 'option_unavailable';
  end if;

  context_payload := jsonb_build_object(
    'source', 'configured',
    'treatmentId', selected_treatment.id,
    'treatmentName', selected_treatment.name,
    'specialtyId', selected_treatment.specialty_id,
    'requiresProfessionalAssignment', selected_treatment.requires_professional_assignment,
    'bufferMinutes', selected_treatment.buffer_minutes,
    'startIntervalMinutes', selected_treatment.start_interval_minutes,
    'bookingConfig', selected_treatment.booking_config,
    'selection', jsonb_build_object(
      'combinationId', requested_combination_id,
      'optionIds', to_jsonb(requested_option_ids)
    ),
    'combination', combination_payload,
    'options', selected_options,
    'includedOptions', included_options,
    'version', md5(jsonb_build_array(
      selected_treatment.updated_at,
      selected_combination.updated_at,
      selected_option_versions,
      relation_versions
    )::text)
  );
  return context_payload;
end;
$function$;
