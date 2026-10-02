begin;

-- The v2 selection API is authoritative. This compatibility function remains
-- for older WhatsApp/RPC callers, with every potentially ambiguous column
-- explicitly qualified so PostgreSQL can validate it deterministically.
create or replace function public.resolve_booking_selection(
  requested_treatment_id uuid,
  requested_combo_id uuid default null,
  requested_monthly_special_id uuid default null
)
returns table (
  treatment_id uuid, specialty_id uuid, professional_id uuid, selection_mode text,
  treatment_name text, combo_id uuid, combo_name text, combo_mode public.combo_mode,
  combo_audience public.depilation_audience, zones jsonb, duration_minutes integer,
  buffer_minutes integer, start_interval_minutes integer, base_price_cents integer,
  applied_price_cents integer, session_count integer, validity_days integer,
  price_per_session_cents integer, savings_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  selected_treatment public.treatments%rowtype;
  selected_combo public.treatment_combos%rowtype;
  selected_special public.monthly_specials%rowtype;
  zone_snapshot jsonb;
  zone_duration integer;
  reference_total integer;
  combos_enabled boolean;
begin
  select treatment.* into selected_treatment
  from public.treatments as treatment
  where treatment.id = requested_treatment_id and treatment.is_active;
  if not found then
    raise exception using errcode = 'P0002', message = 'treatment_not_available';
  end if;

  if selected_treatment.selection_mode = 'simple' then
    if requested_combo_id is not null then
      raise exception using errcode = '22023', message = 'combo_not_allowed';
    end if;
    if requested_monthly_special_id is not null then
      select special.* into selected_special
      from public.monthly_specials as special
      where special.id = requested_monthly_special_id
        and special.treatment_id = requested_treatment_id
        and special.is_active
        and now() >= special.starts_at
        and now() < special.ends_at;
      if not found then
        raise exception using errcode = '22023', message = 'monthly_special_not_available';
      end if;
    end if;
    return query select
      selected_treatment.id, selected_treatment.specialty_id, selected_treatment.professional_id,
      selected_treatment.selection_mode, selected_treatment.name,
      null::uuid, null::text, null::public.combo_mode, null::public.depilation_audience,
      '[]'::jsonb, selected_treatment.duration_minutes, selected_treatment.buffer_minutes,
      selected_treatment.start_interval_minutes, selected_treatment.price_cents,
      coalesce(selected_special.special_price_cents, selected_treatment.price_cents),
      1, null::integer,
      coalesce(selected_special.special_price_cents, selected_treatment.price_cents),
      greatest(0, selected_treatment.price_cents - coalesce(selected_special.special_price_cents, selected_treatment.price_cents));
    return;
  end if;

  select settings.depilation_combos_enabled into combos_enabled
  from public.business_settings as settings where settings.singleton;
  if not coalesce(combos_enabled, false) then
    raise exception using errcode = '22023', message = 'closed_combos_disabled';
  end if;
  if requested_monthly_special_id is not null then
    raise exception using errcode = '22023', message = 'combo_special_conflict';
  end if;
  if requested_combo_id is null then
    raise exception using errcode = '22023', message = 'combo_required';
  end if;

  select combo.* into selected_combo
  from public.treatment_combos as combo
  where combo.id = requested_combo_id
    and combo.treatment_id = requested_treatment_id
    and combo.is_active;
  if not found then
    raise exception using errcode = 'P0002', message = 'combo_not_available';
  end if;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', zone.id, 'name', zone.name, 'audience', zone.audience,
      'referencePriceCents', zone.reference_price_cents,
      'durationMinutes', zone.duration_minutes
    ) order by link.display_order, zone.display_order, zone.name), '[]'::jsonb),
    coalesce(sum(zone.duration_minutes), 0)::integer,
    coalesce(sum(zone.reference_price_cents), 0)::integer * selected_combo.session_count
  into zone_snapshot, zone_duration, reference_total
  from public.treatment_combo_zones as link
  join public.depilation_zones as zone on zone.id = link.zone_id and zone.is_active
  where link.combo_id = selected_combo.id;

  if zone_duration <= 0 then
    raise exception using errcode = '22023', message = 'combo_has_no_active_zones';
  end if;

  return query select
    selected_treatment.id, selected_treatment.specialty_id, selected_treatment.professional_id,
    selected_treatment.selection_mode, selected_treatment.name,
    selected_combo.id, selected_combo.name, selected_combo.mode, selected_combo.audience,
    zone_snapshot, zone_duration, selected_treatment.buffer_minutes,
    selected_treatment.start_interval_minutes, reference_total, selected_combo.fixed_price_cents,
    selected_combo.session_count, selected_combo.validity_days,
    round(selected_combo.fixed_price_cents::numeric / selected_combo.session_count)::integer,
    greatest(0, reference_total - selected_combo.fixed_price_cents);
end;
$$;

revoke all on function public.resolve_booking_selection(uuid,uuid,uuid) from public,authenticated;
grant execute on function public.resolve_booking_selection(uuid,uuid,uuid) to anon;

commit;
