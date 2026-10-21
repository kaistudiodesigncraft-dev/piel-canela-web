-- Optional operational duration for predefined depilation combos.
-- Existing combos remain automatic (sum of zones) because the new value is NULL.
begin;

alter table public.treatment_combos
  add column if not exists appointment_duration_minutes integer
  check (appointment_duration_minutes is null or appointment_duration_minutes between 5 and 480);

create or replace function public.save_depilation_combo_v3(
  requested_combo_id uuid,
  requested_treatment_id uuid,
  requested_name text,
  requested_description text,
  requested_audience public.depilation_audience,
  requested_mode public.combo_mode,
  requested_session_count integer,
  requested_fixed_price_cents integer,
  requested_appointment_duration_minutes integer,
  requested_validity_days integer,
  requested_display_order integer,
  requested_is_active boolean,
  requested_zone_ids jsonb,
  requested_pricing_mode public.combo_pricing_mode,
  requested_discount_percent numeric,
  requested_tier_min_items integer,
  requested_tier_discount_percent numeric,
  requested_allow_public_extras boolean,
  requested_extra_ids jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare saved_combo_id uuid;
begin
  saved_combo_id := public.save_depilation_combo_v2(
    requested_combo_id, requested_treatment_id, requested_name, requested_description,
    requested_audience, requested_mode, requested_session_count, requested_fixed_price_cents,
    requested_validity_days, requested_display_order, requested_is_active, requested_zone_ids,
    requested_pricing_mode, requested_discount_percent, requested_tier_min_items,
    requested_tier_discount_percent, requested_allow_public_extras, requested_extra_ids
  );
  update public.treatment_combos
    set appointment_duration_minutes = requested_appointment_duration_minutes
    where id = saved_combo_id;
  return saved_combo_id;
end;
$$;
revoke all on function public.save_depilation_combo_v3(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb
) from public,anon;
grant execute on function public.save_depilation_combo_v3(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb
) to authenticated;

-- Canonical public context. Price still comes from the combo/zones; only occupied
-- treatment duration may use the explicit operational duration.
create or replace function public.get_depilation_order_context(
  requested_treatment_id uuid, requested_combo_id uuid default null,
  requested_zone_ids uuid[] default '{}'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  t public.treatments%rowtype; c public.treatment_combos%rowtype;
  cfg public.business_settings%rowtype; z jsonb; included jsonb; combo_input jsonb;
  zone_versions jsonb; included_versions jsonb; ctx jsonb;
begin
  select * into cfg from public.business_settings where singleton;
  select * into t from public.treatments where id=requested_treatment_id and is_active;
  if t.id is null or t.selection_mode not in ('closed_combo','combo_with_extras')
    or cfg.depilation_combos_enabled is distinct from true
    or not exists(select 1 from public.specialties where id=t.specialty_id and is_active)
    or not exists(select 1 from public.treatment_categories where id=t.category_id and is_active)
    then raise exception 'treatment_not_available'; end if;
  if requested_zone_ids is null or cardinality(requested_zone_ids)>100
    or cardinality(requested_zone_ids)<>(select count(distinct x) from unnest(requested_zone_ids) x)
    then raise exception 'invalid_zones'; end if;
  if requested_combo_id is null and cardinality(requested_zone_ids)=0 then raise exception 'empty_order'; end if;
  if requested_combo_id is not null then
    select * into c from public.treatment_combos
    where id=requested_combo_id and treatment_id=t.id and is_active and fixed_price_cents>0;
    if c.id is null then raise exception 'combo_not_available'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,
      'priceCents',d.reference_price_cents,'durationMinutes',d.duration_minutes) order by d.id),'[]'),
      coalesce(jsonb_agg(jsonb_build_object('id',d.id,'updatedAt',d.updated_at,'active',d.is_active) order by d.id),'[]')
      into included,included_versions
      from public.treatment_combo_zones l join public.depilation_zones d on d.id=l.zone_id where l.combo_id=c.id;
    if jsonb_array_length(included)=0 or exists (
      select 1 from public.treatment_combo_zones l join public.depilation_zones d on d.id=l.zone_id
      where l.combo_id=c.id and (not d.is_active or d.reference_price_cents<=0)
    ) then raise exception 'combo_not_available'; end if;
    if exists(select 1 from public.treatment_combo_zones l where l.combo_id=c.id and l.zone_id=any(requested_zone_ids))
      then raise exception 'zone_already_in_combo'; end if;
    combo_input:=jsonb_build_object('id',c.id,'name',c.name,'priceCents',c.fixed_price_cents,
      'durationMinutes',coalesce(c.appointment_duration_minutes,
        (select sum((x->>'durationMinutes')::int) from jsonb_array_elements(included) x)),
      'includedZoneIds',(select jsonb_agg(x->'id') from jsonb_array_elements(included) x),
      'sessionCount',c.session_count);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'priceCents',d.reference_price_cents,
    'durationMinutes',d.duration_minutes) order by d.id),'[]'),
    coalesce(jsonb_agg(jsonb_build_object('id',d.id,'updatedAt',d.updated_at) order by d.id),'[]')
    into z,zone_versions from public.depilation_zones d
    where d.id=any(requested_zone_ids) and d.is_active and d.reference_price_cents>0;
  if jsonb_array_length(z)<>cardinality(requested_zone_ids) then raise exception 'zone_not_available'; end if;
  ctx:=jsonb_build_object('treatmentId',t.id,'treatmentName',t.name,'specialtyId',t.specialty_id,
    'bufferMinutes',t.buffer_minutes,'startIntervalMinutes',t.start_interval_minutes,
    'combo',combo_input,'zones',z,'includedZones',coalesce(included,'[]'),
    'comboMode',c.mode,'comboAudience',c.audience,'validityDays',c.validity_days,
    'discountPercent',cfg.depilation_discount_percent,
    'version',md5(jsonb_build_array(t.updated_at,c.updated_at,cfg.updated_at,zone_versions,included_versions)::text));
  return ctx;
end $$;
revoke all on function public.get_depilation_order_context(uuid,uuid,uuid[]) from public;
grant execute on function public.get_depilation_order_context(uuid,uuid,uuid[]) to anon,authenticated;

-- Keep legacy/manual admin booking paths aligned with the same duration.
create or replace function public.resolve_booking_selection_v2(
  requested_treatment_id uuid,
  requested_combo_id uuid default null,
  requested_monthly_special_id uuid default null,
  requested_extra_ids uuid[] default '{}'::uuid[]
)
returns table (
  treatment_id uuid, specialty_id uuid, professional_id uuid, selection_mode text,
  treatment_name text, combo_id uuid, combo_name text, combo_mode public.combo_mode,
  combo_audience public.depilation_audience, zones jsonb, extras jsonb,
  pricing_mode public.combo_pricing_mode, discount jsonb, duration_minutes integer,
  buffer_minutes integer, start_interval_minutes integer, base_price_cents integer,
  applied_price_cents integer, session_count integer, validity_days integer,
  price_per_session_cents integer, savings_cents integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  selected record; extra_snapshot jsonb := '[]'::jsonb; extra_duration integer := 0;
  extra_total integer := 0; item_count integer := 0; computed_price integer;
  discount_payload jsonb := '{}'::jsonb; combo_duration integer;
begin
  select * into selected from public.resolve_booking_selection(requested_treatment_id, requested_combo_id, requested_monthly_special_id);
  if requested_combo_id is null then
    if coalesce(array_length(requested_extra_ids,1),0)>0 then raise exception using errcode='22023',message='extras_require_combo'; end if;
    return query select selected.treatment_id,selected.specialty_id,selected.professional_id,selected.selection_mode,
      selected.treatment_name,selected.combo_id,selected.combo_name,selected.combo_mode,selected.combo_audience,
      selected.zones,'[]'::jsonb,null::public.combo_pricing_mode,'{}'::jsonb,selected.duration_minutes,
      selected.buffer_minutes,selected.start_interval_minutes,selected.base_price_cents,selected.applied_price_cents,
      selected.session_count,selected.validity_days,selected.price_per_session_cents,selected.savings_cents;
    return;
  end if;
  select appointment_duration_minutes into combo_duration from public.treatment_combos where id=requested_combo_id;
  if coalesce(array_length(requested_extra_ids,1),0)>0 then
    if not exists(select 1 from public.treatment_combos where id=requested_combo_id and allow_public_extras)
      then raise exception using errcode='22023',message='combo_extras_not_allowed'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'audience',e.audience,
      'priceCents',e.price_cents,'durationMinutes',e.duration_minutes) order by e.display_order,e.name),'[]'),
      coalesce(sum(e.duration_minutes),0)::integer,coalesce(sum(e.price_cents),0)::integer
    into extra_snapshot,extra_duration,extra_total
    from public.treatment_combo_extras e join public.treatment_combo_allowed_extras a
      on a.extra_id=e.id and a.combo_id=requested_combo_id
    where e.id=any(requested_extra_ids) and e.treatment_id=requested_treatment_id and e.is_active
      and (e.audience='shared' or e.audience=selected.combo_audience);
    if jsonb_array_length(extra_snapshot)<>coalesce(array_length(requested_extra_ids,1),0)
      then raise exception using errcode='22023',message='combo_extra_not_available'; end if;
  end if;
  extra_total:=extra_total*selected.session_count;
  item_count:=jsonb_array_length(selected.zones)+jsonb_array_length(extra_snapshot);
  select case c.pricing_mode
    when 'percentage_discount' then round((selected.base_price_cents+extra_total)*(1-coalesce(c.discount_percent,0)/100.0))::integer
    when 'tiered_discount' then case when item_count>=coalesce(c.tier_min_items,999)
      then round((selected.base_price_cents+extra_total)*(1-coalesce(c.tier_discount_percent,0)/100.0))::integer
      else selected.base_price_cents+extra_total end
    else selected.applied_price_cents+extra_total end,
    jsonb_build_object('pricingMode',c.pricing_mode,'discountPercent',c.discount_percent,
      'tierMinItems',c.tier_min_items,'tierDiscountPercent',c.tier_discount_percent,
      'allowPublicExtras',c.allow_public_extras)
  into computed_price,discount_payload from public.treatment_combos c where c.id=requested_combo_id;
  computed_price:=greatest(0,computed_price);
  return query select selected.treatment_id,selected.specialty_id,selected.professional_id,selected.selection_mode,
    selected.treatment_name,selected.combo_id,selected.combo_name,selected.combo_mode,selected.combo_audience,
    selected.zones,extra_snapshot,(discount_payload->>'pricingMode')::public.combo_pricing_mode,discount_payload,
    coalesce(combo_duration,selected.duration_minutes)+extra_duration,selected.buffer_minutes,
    selected.start_interval_minutes,selected.base_price_cents+extra_total,computed_price,selected.session_count,
    selected.validity_days,round(computed_price::numeric/selected.session_count)::integer,
    greatest(0,selected.base_price_cents+extra_total-computed_price);
end;
$$;
revoke all on function public.resolve_booking_selection_v2(uuid,uuid,uuid,uuid[]) from public;
grant execute on function public.resolve_booking_selection_v2(uuid,uuid,uuid,uuid[]) to anon,authenticated;

commit;
