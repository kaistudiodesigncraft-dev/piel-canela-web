-- H-12: reconcile the repository with the effective production definitions exported 2026-11-03.
-- This migration is a behavioral no-op for production and must be rechecked against a fresh same-day export.
begin;

CREATE OR REPLACE FUNCTION public.delete_professional_if_unlinked(requested_professional_id uuid, request_guard_secret text)
 RETURNS TABLE(full_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  stored_guard_hash text;
  selected_full_name text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  select secret_hash into stored_guard_hash
  from private.booking_guard_config
  where singleton;

  if stored_guard_hash is null
    or request_guard_secret is null
    or char_length(request_guard_secret) < 32
    or encode(extensions.digest(request_guard_secret, 'sha256'), 'hex') <> stored_guard_hash then
    raise exception using errcode = '42501', message = 'deletion_guard_invalid';
  end if;

  select professional.full_name
    into selected_full_name
  from public.professionals as professional
  where professional.id = requested_professional_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'professional_not_found';
  end if;

  if exists (
      select 1 from public.bookings
      where professional_id = requested_professional_id
    ) or exists (
      select 1 from public.treatment_professionals
      where professional_id = requested_professional_id
    ) or exists (
      select 1 from public.professional_identity_reconciliations
      where source_id = requested_professional_id or target_id = requested_professional_id
    ) then
    raise exception using errcode = '23503', message = 'professional_has_history';
  end if;

  delete from public.professionals where id = requested_professional_id;
  return query select selected_full_name;
end;
$function$;

revoke all on function public.delete_professional_if_unlinked(requested_professional_id uuid, request_guard_secret text) from public, anon, authenticated;
grant execute on function public.delete_professional_if_unlinked(requested_professional_id uuid, request_guard_secret text) to authenticated;

CREATE OR REPLACE FUNCTION public.get_available_slots_for_zone_order(payload text, signature text, requested_date date)
 RETURNS TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q jsonb; t uuid; specialty uuid; occupied int; frequency int;
begin
  perform public.expire_pending_bookings();
  q:=private.verify_depilation_quote(payload,signature);
  t:=(q->'context'->>'treatmentId')::uuid;
  specialty:=(q->'context'->>'specialtyId')::uuid;
  occupied:=(q->'order'->>'durationMinutes')::int+(q->'context'->>'bufferMinutes')::int;
  frequency:=(q->'context'->>'startIntervalMinutes')::int;
  return query with cfg as (
    select b.timezone,b.minimum_notice_minutes,b.maximum_advance_days from public.business_settings b where singleton
  ), windows as (
    select (requested_date+r.start_time) at time zone cfg.timezone as a,(requested_date+r.end_time) at time zone cfg.timezone as b
      from cfg join public.availability_rules r on r.specialty_id=specialty and r.weekday=extract(dow from requested_date)::smallint and r.is_active
    union all select e.starts_at,e.ends_at from public.availability_exceptions e cross join cfg
      where e.specialty_id=specialty and e.kind='open' and (e.starts_at at time zone cfg.timezone)::date=requested_date
  ), candidates as (
    select s,s+make_interval(mins=>occupied) as ending from windows w
    cross join lateral generate_series(w.a,w.b-make_interval(mins=>occupied),make_interval(mins=>frequency)) s
  )
  select distinct c.s,c.ending from candidates c cross join cfg
  where c.s>=now()+make_interval(mins=>cfg.minimum_notice_minutes)
    and requested_date<=(now() at time zone cfg.timezone)::date+cfg.maximum_advance_days
    and not exists(select 1 from public.availability_exceptions e where e.specialty_id=specialty and e.kind='blocked'
      and tstzrange(e.starts_at,e.ends_at,'[)')&&tstzrange(c.s,c.ending,'[)'))
    and public.find_available_professional_for_booking(t,c.s,c.ending,null) is not null
  order by c.s;
end $function$;

revoke all on function public.get_available_slots_for_zone_order(payload text, signature text, requested_date date) from public, anon, authenticated;
grant execute on function public.get_available_slots_for_zone_order(payload text, signature text, requested_date date) to authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_depilation_order_context(requested_treatment_id uuid, requested_combo_id uuid DEFAULT NULL::uuid, requested_zone_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.treatments%rowtype;c public.treatment_combos%rowtype;cfg public.business_settings%rowtype;z jsonb;included jsonb;combo_input jsonb;zone_versions jsonb;included_versions jsonb;ctx jsonb;
begin
 select * into cfg from public.business_settings where singleton;
 select * into t from public.treatments where id=requested_treatment_id and is_active;
 if t.id is null or t.selection_mode not in ('closed_combo','combo_with_extras') or cfg.depilation_combos_enabled is distinct from true or not exists(select 1 from public.specialties where id=t.specialty_id and is_active) or not exists(select 1 from public.treatment_categories where id=t.category_id and is_active) then raise exception 'treatment_not_available';end if;
 if requested_zone_ids is null or cardinality(requested_zone_ids)>100 or cardinality(requested_zone_ids)<>(select count(distinct x) from unnest(requested_zone_ids)x) then raise exception 'invalid_zones';end if;
 if requested_combo_id is null and cardinality(requested_zone_ids)=0 then raise exception 'empty_order';end if;
 if requested_combo_id is not null then
  select * into c from public.treatment_combos where id=requested_combo_id and treatment_id=t.id and is_active and fixed_price_cents>0;
  if c.id is null then raise exception 'combo_not_available';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'priceCents',d.reference_price_cents,'durationMinutes',d.duration_minutes)order by d.id),'[]'),coalesce(jsonb_agg(jsonb_build_object('id',d.id,'updatedAt',d.updated_at,'active',d.is_active)order by d.id),'[]') into included,included_versions from public.treatment_combo_zones l join public.depilation_zones d on d.id=l.zone_id where l.combo_id=c.id;
  if jsonb_array_length(included)=0 or exists(select 1 from public.treatment_combo_zones l join public.depilation_zones d on d.id=l.zone_id where l.combo_id=c.id and(not d.is_active or d.reference_price_cents<=0)) then raise exception 'combo_not_available';end if;
  if exists(select 1 from public.treatment_combo_zones l where l.combo_id=c.id and l.zone_id=any(requested_zone_ids)) then raise exception 'zone_already_in_combo';end if;
  combo_input:=jsonb_build_object('id',c.id,'name',c.name,'priceCents',c.fixed_price_cents,'durationMinutes',coalesce(c.appointment_duration_minutes,(select sum((x->>'durationMinutes')::int)from jsonb_array_elements(included)x)),'includedZoneIds',(select jsonb_agg(x->'id')from jsonb_array_elements(included)x),'sessionCount',c.session_count);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'priceCents',d.reference_price_cents,'durationMinutes',d.duration_minutes)order by d.id),'[]'),coalesce(jsonb_agg(jsonb_build_object('id',d.id,'updatedAt',d.updated_at)order by d.id),'[]') into z,zone_versions from public.depilation_zones d where d.id=any(requested_zone_ids)and d.is_active and d.reference_price_cents>0;
 if jsonb_array_length(z)<>cardinality(requested_zone_ids)then raise exception 'zone_not_available';end if;
 ctx:=jsonb_build_object('treatmentId',t.id,'treatmentName',t.name,'specialtyId',t.specialty_id,'bufferMinutes',t.buffer_minutes,'startIntervalMinutes',t.start_interval_minutes,'combo',combo_input,'zones',z,'includedZones',coalesce(included,'[]'),'comboMode',c.mode,'comboAudience',c.audience,'validityDays',c.validity_days,'discountPercent',cfg.depilation_discount_percent,'version',md5(jsonb_build_array(t.updated_at,c.updated_at,cfg.updated_at,zone_versions,included_versions)::text));return ctx;
end $function$;

revoke all on function public.get_depilation_order_context(requested_treatment_id uuid, requested_combo_id uuid, requested_zone_ids uuid[]) from public, anon, authenticated;
grant execute on function public.get_depilation_order_context(requested_treatment_id uuid, requested_combo_id uuid, requested_zone_ids uuid[]) to authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_professional_usage_counts()
 RETURNS TABLE(professional_id uuid, treatment_count bigint, booking_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  return query
  select
    professional.id,
    coalesce(treatment_usage.total, 0),
    coalesce(booking_usage.total, 0)
  from public.professionals as professional
  left join (
    select assignment.professional_id, count(*)::bigint as total
    from public.treatment_professionals as assignment
    group by assignment.professional_id
  ) as treatment_usage on treatment_usage.professional_id = professional.id
  left join (
    select booking.professional_id, count(*)::bigint as total
    from public.bookings as booking
    where booking.professional_id is not null
    group by booking.professional_id
  ) as booking_usage on booking_usage.professional_id = professional.id;
end;
$function$;

revoke all on function public.get_professional_usage_counts() from public, anon, authenticated;
grant execute on function public.get_professional_usage_counts() to authenticated;

CREATE OR REPLACE FUNCTION public.publish_site_content_section(p_section site_content_section)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  revision_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  perform 1 from public.site_content where section = p_section for update;

  insert into public.site_content_revisions(section, snapshot, reason, created_by)
  select p_section, jsonb_agg(to_jsonb(content) order by content.display_order), 'publish', auth.uid()
  from public.site_content as content where content.section = p_section
  returning id into revision_id;

  update public.site_content as published set
    value = draft.value,
    image_path = draft.image_path,
    image_alt = draft.image_alt,
    focal_x = draft.focal_x,
    focal_y = draft.focal_y,
    presentation = draft.presentation,
    surface_preset = draft.surface_preset,

    overlay_preset = draft.overlay_preset,
    enabled = draft.enabled,
    updated_by = auth.uid()
  from public.site_content_drafts as draft
  where published.key = draft.key and published.section = p_section;

  return revision_id;
end;
$function$;

revoke all on function public.publish_site_content_section(p_section site_content_section) from public, anon, authenticated;
grant execute on function public.publish_site_content_section(p_section site_content_section) to authenticated;

CREATE OR REPLACE FUNCTION public.reconcile_professional_identity(source_professional_id uuid, target_professional_id uuid, restore_reason text, verified_backup_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  source_profile public.professionals%rowtype;
  target_profile public.professionals%rowtype;
  snapshot jsonb;
  reconciliation_id uuid;
begin
  if not public.is_owner(auth.uid()) then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;
  if source_professional_id is null or target_professional_id is null
    or source_professional_id = target_professional_id
    or coalesce(length(trim(restore_reason)), 0) not between 10 and 1000
    or coalesce(length(trim(verified_backup_reference)), 0) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'identity_confirmation_required';
  end if;
  lock table public.professionals, public.professional_specialties,
    public.treatment_professionals, public.treatments,
    public.professional_availability_rules, public.professional_availability_exceptions,
    public.bookings, public.professional_identity_reconciliations in share row exclusive mode;
  select * into source_profile from public.professionals where id = source_professional_id;
  select * into target_profile from public.professionals where id = target_professional_id;
  if source_profile.id is null or target_profile.id is null or not target_profile.is_active then
    raise exception using errcode = '22023', message = 'professional_not_available';
  end if;
  if exists (select 1 from public.professional_identity_reconciliations
    where source_id in (source_professional_id, target_professional_id)
       or target_id = source_professional_id) then
    raise exception using errcode = '22023', message = 'identity_already_reconciled';
  end if;
  if exists (
    select 1 from public.bookings a join public.bookings b
      on a.professional_id = source_professional_id and b.professional_id = target_professional_id
      and a.status in ('pending','awaiting_deposit','confirmed')
      and b.status in ('pending','awaiting_deposit','confirmed')
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
  ) then
    raise exception using errcode = '23P01', message = 'professional_identity_booking_conflict';
  end if;
  if exists (select 1 from public.professional_availability_rules
    where professional_id in (source_professional_id,target_professional_id) and is_active) then
    raise exception using errcode = '22023', message = 'professional_schedule_review_required';
  end if;
  if exists (
    select 1 from public.professional_availability_exceptions e join public.bookings b
      on b.professional_id in (source_professional_id,target_professional_id)
      and b.status in ('pending','awaiting_deposit','confirmed')
      and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
    where e.professional_id in (source_professional_id,target_professional_id) and e.kind = 'blocked'
  ) then
    raise exception using errcode = '23P01', message = 'professional_identity_block_conflict';
  end if;
  snapshot := jsonb_build_object(
    'source', to_jsonb(source_profile), 'target', to_jsonb(target_profile),
    'bookings', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.bookings b where professional_id in (source_professional_id,target_professional_id)),
    'treatments', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.treatments t where professional_id in (source_professional_id,target_professional_id)),
    'assignments', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.treatment_professionals t where professional_id in (source_professional_id,target_professional_id)),
    'specialties', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.professional_specialties t where professional_id in (source_professional_id,target_professional_id)),
    'rules', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.professional_availability_rules t where professional_id in (source_professional_id,target_professional_id)),
    'exceptions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.professional_availability_exceptions t where professional_id in (source_professional_id,target_professional_id))
  );
  insert into public.professional_identity_reconciliations(source_id,target_id,actor_id,reason,backup_reference,before_snapshot)
    values (source_professional_id,target_professional_id,auth.uid(),trim(restore_reason),trim(verified_backup_reference),snapshot)
    returning id into reconciliation_id;
  insert into public.professional_specialties(professional_id,specialty_id)
    select target_professional_id,specialty_id from public.professional_specialties where professional_id=source_professional_id
    union select target_professional_id,source_profile.specialty_id
    on conflict do nothing;
  insert into public.treatment_professionals(treatment_id,professional_id,is_active,display_order)
    select treatment_id,target_professional_id,is_active,display_order from public.treatment_professionals where professional_id=source_professional_id
    on conflict (treatment_id,professional_id) do update set is_active = public.treatment_professionals.is_active or excluded.is_active;
  update public.treatment_professionals set is_active=false where professional_id=source_professional_id;
  update public.treatments set professional_id=target_professional_id where professional_id=source_professional_id;
  update public.professional_availability_exceptions set professional_id=target_professional_id where professional_id=source_professional_id;
  update public.bookings set professional_id=target_professional_id where professional_id=source_professional_id;
  update public.professionals set is_active=false where id=source_professional_id;
  insert into public.audit_log(actor_id,table_name,record_id,action,new_data)
    values(auth.uid(),'professional_identity_reconciliations',reconciliation_id,'insert',
      jsonb_build_object('source_id',source_professional_id,'target_id',target_professional_id,'reason',trim(restore_reason)));
  return reconciliation_id;
end;
$function$;

revoke all on function public.reconcile_professional_identity(source_professional_id uuid, target_professional_id uuid, restore_reason text, verified_backup_reference text) from public, anon, authenticated;
grant execute on function public.reconcile_professional_identity(source_professional_id uuid, target_professional_id uuid, restore_reason text, verified_backup_reference text) to authenticated;

CREATE OR REPLACE FUNCTION public.resolve_booking_selection_v2(requested_treatment_id uuid, requested_combo_id uuid DEFAULT NULL::uuid, requested_monthly_special_id uuid DEFAULT NULL::uuid, requested_extra_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS TABLE(treatment_id uuid, specialty_id uuid, professional_id uuid, selection_mode text, treatment_name text, combo_id uuid, combo_name text, combo_mode combo_mode, combo_audience depilation_audience, zones jsonb, extras jsonb, pricing_mode combo_pricing_mode, discount jsonb, duration_minutes integer, buffer_minutes integer, start_interval_minutes integer, base_price_cents integer, applied_price_cents integer, session_count integer, validity_days integer, price_per_session_cents integer, savings_cents integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare selected record;extra_snapshot jsonb:='[]'::jsonb;extra_duration integer:=0;extra_total integer:=0;item_count integer:=0;computed_price integer;discount_payload jsonb:='{}'::jsonb;combo_duration integer;
begin
 select * into selected from public.resolve_booking_selection(requested_treatment_id,requested_combo_id,requested_monthly_special_id);
 if requested_combo_id is null then
  if coalesce(array_length(requested_extra_ids,1),0)>0 then raise exception using errcode='22023',message='extras_require_combo';end if;
  return query select selected.treatment_id,selected.specialty_id,selected.professional_id,selected.selection_mode,selected.treatment_name,selected.combo_id,selected.combo_name,selected.combo_mode,selected.combo_audience,selected.zones,'[]'::jsonb,null::public.combo_pricing_mode,'{}'::jsonb,selected.duration_minutes,selected.buffer_minutes,selected.start_interval_minutes,selected.base_price_cents,selected.applied_price_cents,selected.session_count,selected.validity_days,selected.price_per_session_cents,selected.savings_cents;return;
 end if;
 select appointment_duration_minutes into combo_duration from public.treatment_combos where id=requested_combo_id;
 if coalesce(array_length(requested_extra_ids,1),0)>0 then
  if not exists(select 1 from public.treatment_combos where id=requested_combo_id and allow_public_extras)then raise exception using errcode='22023',message='combo_extras_not_allowed';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'audience',e.audience,'priceCents',e.price_cents,'durationMinutes',e.duration_minutes)order by e.display_order,e.name),'[]'),coalesce(sum(e.duration_minutes),0)::integer,coalesce(sum(e.price_cents),0)::integer into extra_snapshot,extra_duration,extra_total from public.treatment_combo_extras e join public.treatment_combo_allowed_extras a on a.extra_id=e.id and a.combo_id=requested_combo_id where e.id=any(requested_extra_ids)and e.treatment_id=requested_treatment_id and e.is_active and(e.audience='shared'or e.audience=selected.combo_audience);
  if jsonb_array_length(extra_snapshot)<>coalesce(array_length(requested_extra_ids,1),0)then raise exception using errcode='22023',message='combo_extra_not_available';end if;
 end if;
 extra_total:=extra_total*selected.session_count;item_count:=jsonb_array_length(selected.zones)+jsonb_array_length(extra_snapshot);
 select case c.pricing_mode when 'percentage_discount'then round((selected.base_price_cents+extra_total)*(1-coalesce(c.discount_percent,0)/100.0))::integer when 'tiered_discount'then case when item_count>=coalesce(c.tier_min_items,999)then round((selected.base_price_cents+extra_total)*(1-coalesce(c.tier_discount_percent,0)/100.0))::integer else selected.base_price_cents+extra_total end else selected.applied_price_cents+extra_total end,jsonb_build_object('pricingMode',c.pricing_mode,'discountPercent',c.discount_percent,'tierMinItems',c.tier_min_items,'tierDiscountPercent',c.tier_discount_percent,'allowPublicExtras',c.allow_public_extras)into computed_price,discount_payload from public.treatment_combos c where c.id=requested_combo_id;
 computed_price:=greatest(0,computed_price);
 return query select selected.treatment_id,selected.specialty_id,selected.professional_id,selected.selection_mode,selected.treatment_name,selected.combo_id,selected.combo_name,selected.combo_mode,selected.combo_audience,selected.zones,extra_snapshot,(discount_payload->>'pricingMode')::public.combo_pricing_mode,discount_payload,coalesce(combo_duration,selected.duration_minutes)+extra_duration,selected.buffer_minutes,selected.start_interval_minutes,selected.base_price_cents+extra_total,computed_price,selected.session_count,selected.validity_days,round(computed_price::numeric/selected.session_count)::integer,greatest(0,selected.base_price_cents+extra_total-computed_price);
end $function$;

revoke all on function public.resolve_booking_selection_v2(requested_treatment_id uuid, requested_combo_id uuid, requested_monthly_special_id uuid, requested_extra_ids uuid[]) from public, anon, authenticated;
grant execute on function public.resolve_booking_selection_v2(requested_treatment_id uuid, requested_combo_id uuid, requested_monthly_special_id uuid, requested_extra_ids uuid[]) to authenticated, anon;

CREATE OR REPLACE FUNCTION public.save_depilation_combo_v3(requested_combo_id uuid, requested_treatment_id uuid, requested_name text, requested_description text, requested_audience depilation_audience, requested_mode combo_mode, requested_session_count integer, requested_fixed_price_cents integer, requested_appointment_duration_minutes integer, requested_validity_days integer, requested_display_order integer, requested_is_active boolean, requested_zone_ids jsonb, requested_pricing_mode combo_pricing_mode, requested_discount_percent numeric, requested_tier_min_items integer, requested_tier_discount_percent numeric, requested_allow_public_extras boolean, requested_extra_ids jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare saved_combo_id uuid;
begin
 saved_combo_id:=public.save_depilation_combo_v2(requested_combo_id,requested_treatment_id,requested_name,requested_description,requested_audience,requested_mode,requested_session_count,requested_fixed_price_cents,requested_validity_days,requested_display_order,requested_is_active,requested_zone_ids,requested_pricing_mode,requested_discount_percent,requested_tier_min_items,requested_tier_discount_percent,requested_allow_public_extras,requested_extra_ids);
 update public.treatment_combos set appointment_duration_minutes=requested_appointment_duration_minutes where id=saved_combo_id;
 return saved_combo_id;
end $function$;

revoke all on function public.save_depilation_combo_v3(requested_combo_id uuid, requested_treatment_id uuid, requested_name text, requested_description text, requested_audience depilation_audience, requested_mode combo_mode, requested_session_count integer, requested_fixed_price_cents integer, requested_appointment_duration_minutes integer, requested_validity_days integer, requested_display_order integer, requested_is_active boolean, requested_zone_ids jsonb, requested_pricing_mode combo_pricing_mode, requested_discount_percent numeric, requested_tier_min_items integer, requested_tier_discount_percent numeric, requested_allow_public_extras boolean, requested_extra_ids jsonb) from public, anon, authenticated;
grant execute on function public.save_depilation_combo_v3(requested_combo_id uuid, requested_treatment_id uuid, requested_name text, requested_description text, requested_audience depilation_audience, requested_mode combo_mode, requested_session_count integer, requested_fixed_price_cents integer, requested_appointment_duration_minutes integer, requested_validity_days integer, requested_display_order integer, requested_is_active boolean, requested_zone_ids jsonb, requested_pricing_mode combo_pricing_mode, requested_discount_percent numeric, requested_tier_min_items integer, requested_tier_discount_percent numeric, requested_allow_public_extras boolean, requested_extra_ids jsonb) to authenticated;

commit;
