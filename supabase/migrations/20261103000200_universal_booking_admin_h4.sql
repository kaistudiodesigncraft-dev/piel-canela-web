-- H4: transactional administration for the neutral configurable catalog.
-- Additive only. Historical Depilation tables and functions remain untouched.

create or replace function public.protect_active_treatment_option_usage()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.is_active
    and (not new.is_active or new.price_cents <= 0)
    and exists (
      select 1
      from public.treatment_option_combo_items as item
      join public.treatment_option_combos as combo on combo.id = item.combo_id
      where item.option_id = old.id
        and item.treatment_id = old.treatment_id
        and combo.is_active
    ) then
    raise exception using errcode = '23514', message = 'option_used_by_active_combination';
  end if;
  return new;
end;
$function$;

revoke all on function public.protect_active_treatment_option_usage()
  from public, anon, authenticated;

create trigger treatment_options_protect_active_usage
  before update of is_active, price_cents on public.treatment_options
  for each row execute function public.protect_active_treatment_option_usage();

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
  active_combinations integer;
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
  if selected_mode = 'package' then
    raise exception using errcode = '0A000', message = 'package_flow_not_enabled';
  end if;

  select count(*) into active_options
  from public.treatment_options
  where treatment_id = new.id and is_active and price_cents > 0;
  select count(*) into active_combinations
  from public.treatment_option_combos
  where treatment_id = new.id and is_active and price_cents > 0;

  if selected_mode = 'simple' and (active_options > 0 or active_combinations > 0) then
    raise exception using errcode = '23514', message = 'simple_config_has_active_catalog';
  elsif selected_mode = 'options' and active_options = 0 then
    raise exception using errcode = '23514', message = 'options_config_requires_active_option';
  elsif selected_mode = 'options' and not allow_combos and active_combinations > 0 then
    raise exception using errcode = '23514', message = 'options_config_disallows_active_combinations';
  elsif selected_mode = 'closed_combos' and active_combinations = 0 then
    raise exception using errcode = '23514', message = 'closed_combos_requires_active_combination';
  elsif selected_mode = 'combos_with_addons'
    and active_combinations = 0
    and (not allow_loose or active_options = 0) then
    raise exception using errcode = '23514', message = 'combos_config_requires_public_selection';
  end if;

  if selected_mode <> 'package' and exists (
    select 1 from public.treatment_option_combos
    where treatment_id = new.id and is_active and kind <> 'combo'
  ) then
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

create trigger treatments_enforce_configured_readiness
  before insert or update of booking_config, config_enabled on public.treatments
  for each row execute function public.enforce_configured_treatment_readiness();

create or replace function public.save_treatment_option_combo_v1(
  requested_combo_id uuid,
  requested_treatment_id uuid,
  requested_name text,
  requested_description text,
  requested_kind text,
  requested_price_cents integer,
  requested_duration_minutes integer,
  requested_session_count integer,
  requested_display_order integer,
  requested_is_active boolean,
  requested_included_option_ids uuid[],
  requested_addon_option_ids uuid[],
  expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  selected_treatment public.treatments%rowtype;
  selected_combo public.treatment_option_combos%rowtype;
  selected_mode text;
  selected_combo_id uuid := coalesce(requested_combo_id, gen_random_uuid());
  included_ids uuid[] := coalesce(requested_included_option_ids, '{}'::uuid[]);
  addon_ids uuid[] := coalesce(requested_addon_option_ids, '{}'::uuid[]);
  all_option_ids uuid[];
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if requested_treatment_id is null
    or requested_name is null
    or char_length(trim(requested_name)) not between 1 and 120
    or char_length(trim(coalesce(requested_description, ''))) > 500
    or requested_kind not in ('combo', 'package')
    or requested_price_cents not between 0 and 2147483647
    or requested_duration_minutes not between 1 and 1440
    or requested_session_count not between 1 and 100
    or requested_display_order not between 0 and 9999
    or requested_is_active is null then
    raise exception using errcode = '22023', message = 'invalid_combo_payload';
  end if;

  if cardinality(included_ids) <> (
    select count(distinct option_id) from unnest(included_ids) as option_id
  ) or cardinality(addon_ids) <> (
    select count(distinct option_id) from unnest(addon_ids) as option_id
  ) then
    raise exception using errcode = '22023', message = 'duplicate_option';
  end if;

  if included_ids && addon_ids then
    raise exception using errcode = '22023', message = 'option_role_conflict';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('booking-config:' || requested_treatment_id::text, 0));
  select * into selected_treatment
  from public.treatments
  where id = requested_treatment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'treatment_not_found';
  end if;
  if selected_treatment.booking_config is null then
    raise exception using errcode = '23514', message = 'booking_config_required';
  end if;

  selected_mode := selected_treatment.booking_config->>'mode';
  if selected_mode not in ('options', 'closed_combos', 'combos_with_addons', 'package') then
    raise exception using errcode = '23514', message = 'combination_not_allowed_for_mode';
  end if;
  if selected_mode = 'options'
    and coalesce((selected_treatment.booking_config->>'allowCombos')::boolean, false) is not true then
    raise exception using errcode = '23514', message = 'combination_not_allowed_for_mode';
  end if;
  if selected_mode = 'package' and requested_kind <> 'package' then
    raise exception using errcode = '23514', message = 'package_kind_required';
  end if;
  if selected_mode <> 'package' and requested_kind <> 'combo' then
    raise exception using errcode = '23514', message = 'combo_kind_required';
  end if;
  if selected_mode <> 'combos_with_addons' and cardinality(addon_ids) > 0 then
    raise exception using errcode = '23514', message = 'addons_not_allowed_for_mode';
  end if;
  if selected_mode = 'combos_with_addons'
    and cardinality(addon_ids) > 0
    and coalesce((selected_treatment.booking_config->>'allowAddons')::boolean, false) is not true then
    raise exception using errcode = '23514', message = 'addons_not_allowed_for_mode';
  end if;
  if cardinality(included_ids) = 0 then
    raise exception using errcode = '23514', message = 'combination_requires_option';
  end if;

  all_option_ids := included_ids || addon_ids;
  if (
    select count(*)
    from public.treatment_options as option
    where option.treatment_id = requested_treatment_id
      and option.id = any(all_option_ids)
  ) <> cardinality(all_option_ids) then
    raise exception using errcode = '23514', message = 'option_not_available';
  end if;

  if requested_is_active and exists (
    select 1
    from unnest(all_option_ids) as selected_id
    left join public.treatment_options as option
      on option.id = selected_id
      and option.treatment_id = requested_treatment_id
    where option.id is null or not option.is_active or option.price_cents <= 0
  ) then
    raise exception using errcode = '23514', message = 'active_combination_requires_active_options';
  end if;

  if requested_combo_id is not null then
    select * into selected_combo
    from public.treatment_option_combos
    where id = requested_combo_id
      and treatment_id = requested_treatment_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'combination_not_found';
    end if;
    if expected_updated_at is null or selected_combo.updated_at is distinct from expected_updated_at then
      raise exception using errcode = '40001', message = 'combination_version_conflict';
    end if;

    update public.treatment_option_combos
    set name = trim(requested_name),
        description = trim(coalesce(requested_description, '')),
        kind = requested_kind,
        price_cents = requested_price_cents,
        duration_minutes = requested_duration_minutes,
        session_count = requested_session_count,
        display_order = requested_display_order,
        is_active = requested_is_active
    where id = selected_combo_id;
  else
    insert into public.treatment_option_combos(
      id, treatment_id, name, description, kind, price_cents,
      duration_minutes, session_count, display_order, is_active
    ) values (
      selected_combo_id, requested_treatment_id, trim(requested_name),
      trim(coalesce(requested_description, '')), requested_kind,
      requested_price_cents, requested_duration_minutes,
      requested_session_count, requested_display_order, requested_is_active
    );
  end if;

  delete from public.treatment_option_combo_items
  where combo_id = selected_combo_id
    and treatment_id = requested_treatment_id;

  insert into public.treatment_option_combo_items(
    treatment_id, combo_id, option_id, role, display_order
  )
  select requested_treatment_id, selected_combo_id, selected.option_id, 'included', selected.ordinality - 1
  from unnest(included_ids) with ordinality as selected(option_id, ordinality);

  insert into public.treatment_option_combo_items(
    treatment_id, combo_id, option_id, role, display_order
  )
  select requested_treatment_id, selected_combo_id, selected.option_id, 'addon', selected.ordinality - 1
  from unnest(addon_ids) with ordinality as selected(option_id, ordinality);

  return selected_combo_id;
end;
$function$;

revoke all on function public.save_treatment_option_combo_v1(
  uuid, uuid, text, text, text, integer, integer, integer, integer,
  boolean, uuid[], uuid[], timestamptz
) from public, anon;
grant execute on function public.save_treatment_option_combo_v1(
  uuid, uuid, text, text, text, integer, integer, integer, integer,
  boolean, uuid[], uuid[], timestamptz
) to authenticated;

comment on function public.save_treatment_option_combo_v1(
  uuid, uuid, text, text, text, integer, integer, integer, integer,
  boolean, uuid[], uuid[], timestamptz
) is 'Atomically saves a neutral configurable combination and replaces its option roles.';
