-- Additive: no catalog updates, conversions, deletes or existing booking changes.
begin;
alter table public.business_settings
  add column depilation_discount_percent numeric(5,2) not null default 0
  check (depilation_discount_percent between 0 and 100);
alter table public.bookings add column depilation_order_snapshot jsonb;
grant select (depilation_discount_percent) on public.business_settings to anon, authenticated;
grant update (depilation_discount_percent) on public.business_settings to authenticated;

-- Restrictive companion policies preserve the existing publication/feature gates.
create policy depilation_zones_public_priced on public.depilation_zones
  as restrictive for select to anon using (reference_price_cents > 0);
create policy treatment_combos_public_priced on public.treatment_combos
  as restrictive for select to anon using (fixed_price_cents > 0);

-- Canonical input and version fingerprint, NOT a pricing calculation.
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
      'durationMinutes',(select sum((x->>'durationMinutes')::int) from jsonb_array_elements(included) x),
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

-- The HMAC authenticates the result of the one TypeScript calculator.
-- The secret hash is already stored privately; no secret is returned to browsers.
create or replace function private.verify_depilation_quote(payload text, signature text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q jsonb; secret_hash text; current_ctx jsonb; ids uuid[];
begin
  if payload is null or length(payload)>100000 or signature is null or signature !~ '^[a-f0-9]{64}$' then raise exception 'invalid_quote'; end if;
  select c.secret_hash into secret_hash from private.booking_guard_config c where singleton;
  if secret_hash is null or encode(extensions.hmac(convert_to(payload,'UTF8'),convert_to(secret_hash,'UTF8'),'sha256'),'hex')<>signature
    then raise exception 'invalid_quote'; end if;
  q:=payload::jsonb;
  if q->>'purpose' is distinct from 'depilation-order-v1' or q->>'expiresAt' is null or (q->>'expiresAt')::timestamptz<now()
    or (q->>'expiresAt')::timestamptz>now()+interval '16 minutes' then raise exception 'quote_expired'; end if;
  select coalesce(array_agg(x::uuid),'{}') into ids from jsonb_array_elements_text(q->'zoneIds') x;
  current_ctx:=public.get_depilation_order_context((q->'context'->>'treatmentId')::uuid,
    (q->'context'->'combo'->>'id')::uuid,ids);
  if current_ctx is distinct from q->'context' then raise exception 'quote_changed'; end if;
  if q->'order'->>'durationMinutes' is null or q->'order'->>'totalCents' is null
    or (q->'order'->>'durationMinutes')::int<=0 or (q->'order'->>'totalCents')::int<0 then raise exception 'invalid_quote'; end if;
  return q;
end $$;
revoke all on function private.verify_depilation_quote(text,text) from public,anon,authenticated;

create or replace function public.get_available_slots_for_zone_order(payload text, signature text, requested_date date)
returns table(starts_at timestamptz,ends_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare q jsonb; t uuid; specialty uuid; occupied int; frequency int;
begin
  perform public.expire_pending_bookings();
  q:=private.verify_depilation_quote(payload,signature);
  t:=(q->'context'->>'treatmentId')::uuid; specialty:=(q->'context'->>'specialtyId')::uuid;
  occupied:=(q->'order'->>'durationMinutes')::int+(q->'context'->>'bufferMinutes')::int;
  frequency:=(q->'context'->>'startIntervalMinutes')::int;
  return query with cfg as (
    select b.timezone,b.minimum_notice_minutes,b.maximum_advance_days from public.business_settings b where singleton
  ), windows as (
    select (requested_date+r.start_time) at time zone cfg.timezone as a,
      (requested_date+r.end_time) at time zone cfg.timezone as b
      from cfg join public.availability_rules r on r.specialty_id=specialty
      and r.weekday=extract(dow from requested_date)::smallint and r.is_active
    union all select e.starts_at,e.ends_at from public.availability_exceptions e cross join cfg
      where e.specialty_id=specialty and e.kind='open'
      and (e.starts_at at time zone cfg.timezone)::date=requested_date
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
end $$;
revoke all on function public.get_available_slots_for_zone_order(text,text,date) from public;
grant execute on function public.get_available_slots_for_zone_order(text,text,date) to anon,authenticated;

create or replace function public.create_booking_for_zone_order(
  payload text, signature text, requested_starts_at timestamptz, requested_idempotency_key uuid,
  customer_full_name text, customer_phone text, customer_email text, customer_notes text,
  request_guard_nonce uuid, request_guard_fingerprint text, request_guard_secret text
) returns table(booking_id uuid,booking_code text,status public.booking_status)
language plpgsql security definer set search_path = '' as $$
declare
  q jsonb; ctx jsonb; ord jsonb; b public.bookings%rowtype; customer uuid; professional uuid;
  guard_hash text; n int; attempts int; ending timestamptz; treatment uuid; combo uuid; booking_timezone text;
begin
  select c.secret_hash into guard_hash from private.booking_guard_config c where singleton;
  if requested_idempotency_key is null or requested_starts_at is null
    or guard_hash is null or request_guard_secret is null or length(request_guard_secret)<32
    or encode(extensions.digest(request_guard_secret,'sha256'),'hex')<>guard_hash
    or request_guard_nonce is null or request_guard_fingerprint is null or request_guard_fingerprint!~'^[a-f0-9]{64}$'
    then raise exception 'booking_guard_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_idempotency_key::text,0));
  select * into b from public.bookings where idempotency_key=requested_idempotency_key;
  if found then return query select b.id,b.booking_code,b.status; return; end if;
  q:=private.verify_depilation_quote(payload,signature);
  ctx:=q->'context'; ord:=q->'order'; treatment:=(ctx->>'treatmentId')::uuid; combo:=(ctx->'combo'->>'id')::uuid;
  -- Lock all inputs before comparing the version again; edits cannot race booking.
  perform 1 from public.business_settings where singleton for share;
  select timezone into booking_timezone from public.business_settings where singleton;
  perform 1 from public.treatments where id=treatment for share;
  perform 1 from public.treatment_combos where id=combo for share;
  perform 1 from public.treatment_combo_zones where combo_id=combo order by zone_id for share;
  perform 1 from public.depilation_zones d where d.id in (
    select x::uuid from jsonb_array_elements_text(q->'zoneIds') x
    union select l.zone_id from public.treatment_combo_zones l where l.combo_id=combo
  ) order by d.id for share;
  q:=private.verify_depilation_quote(payload,signature);
  if customer_full_name is null or char_length(trim(customer_full_name)) not between 2 and 100
    or customer_phone is null or char_length(trim(customer_phone)) not between 8 and 30
    or length(coalesce(customer_email,''))>180 or length(coalesce(customer_notes,''))>240 then raise exception 'invalid_customer_data'; end if;
  insert into private.booking_guard_nonces(nonce,fingerprint) values(request_guard_nonce,request_guard_fingerprint) on conflict do nothing;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'booking_guard_replayed'; end if;
  insert into private.booking_rate_limits as r(fingerprint,window_started_at,attempts,updated_at)
  values(request_guard_fingerprint,now(),1,now()) on conflict(fingerprint) do update set
    attempts=case when r.window_started_at<=now()-interval '1 hour' then 1 else r.attempts+1 end,
    window_started_at=case when r.window_started_at<=now()-interval '1 hour' then now() else r.window_started_at end,
    updated_at=now() returning r.attempts into attempts;
  if attempts>6 then raise exception 'booking_rate_limited'; end if;
  ending:=requested_starts_at+make_interval(mins=>(ord->>'durationMinutes')::int+(ctx->>'bufferMinutes')::int);
  professional:=public.auto_assign_professional_for_booking(treatment,requested_starts_at,ending,null);
  if not exists(select 1 from public.get_available_slots_for_zone_order(payload,signature,
    (requested_starts_at at time zone booking_timezone)::date) s where s.starts_at=requested_starts_at)
    then raise exception 'slot_not_available'; end if;
  insert into public.customers(full_name,phone,email)
    values(trim(customer_full_name),trim(customer_phone),nullif(trim(customer_email),'')) returning id into customer;
  insert into public.bookings(idempotency_key,customer_id,treatment_id,specialty_id,professional_id,
    starts_at,ends_at,duration_snapshot_minutes,buffer_snapshot_minutes,base_price_snapshot_cents,applied_price_snapshot_cents,
    treatment_name_snapshot,customer_notes,treatment_combo_id,combo_name_snapshot,combo_mode_snapshot,combo_audience_snapshot,
    combo_zones_snapshot,combo_extras_snapshot,combo_session_count_snapshot,combo_validity_days_snapshot,
    combo_reference_price_snapshot_cents,combo_price_per_session_snapshot_cents,combo_savings_snapshot_cents,
    combo_discount_snapshot,package_charge_kind,depilation_order_snapshot)
  values(requested_idempotency_key,customer,treatment,(ctx->>'specialtyId')::uuid,professional,
    requested_starts_at,ending,(ord->>'durationMinutes')::int,(ctx->>'bufferMinutes')::int,
    (ord->>'subtotalCents')::int,(ord->>'totalCents')::int,ctx->>'treatmentName',nullif(trim(customer_notes),''),
    combo,ctx->'combo'->>'name',(ctx->>'comboMode')::public.combo_mode,(ctx->>'comboAudience')::public.depilation_audience,
    case when combo is null then ctx->'zones' else ctx->'includedZones' end,case when combo is null then '[]'::jsonb else ctx->'zones' end,
    coalesce((ctx->'combo'->>'sessionCount')::int,1),(ctx->>'validityDays')::int,
    (ord->>'subtotalCents')::int,round((ord->>'totalCents')::numeric/coalesce((ctx->'combo'->>'sessionCount')::int,1))::int,
    (ord->>'discountCents')::int,jsonb_build_object('discountPercent',ord->'discountPercent','discountCents',ord->'discountCents'),
    case when ctx->>'comboMode'='package' then 'package_initial' else 'standard' end,
    jsonb_build_object('version',1,'context',ctx,'order',ord))
    returning * into b;
  return query select b.id,b.booking_code,b.status;
exception when exclusion_violation then raise exception 'slot_not_available';
end $$;
revoke all on function public.create_booking_for_zone_order(text,text,timestamptz,uuid,text,text,text,text,uuid,text,text) from public;
grant execute on function public.create_booking_for_zone_order(text,text,timestamptz,uuid,text,text,text,text,uuid,text,text) to anon,authenticated;

-- Only future packages from this flow inherit all contracted zones. Existing
-- packages/activations remain unchanged, including their historic pricing.
create or replace function private.zone_order_package_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
declare snapshot jsonb;
begin
  select depilation_order_snapshot into snapshot from public.bookings where id=new.initial_booking_id;
  if snapshot is not null then
    new.zones_snapshot:=coalesce(snapshot->'context'->'includedZones','[]'::jsonb)
      ||coalesce(snapshot->'context'->'zones','[]'::jsonb);
  end if;
  return new;
end $$;
revoke all on function private.zone_order_package_snapshot() from public,anon,authenticated;
create trigger zone_order_package_snapshot before insert on public.customer_packages
for each row execute function private.zone_order_package_snapshot();
commit;
