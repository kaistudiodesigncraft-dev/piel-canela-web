-- Additive repair. No changes to existing client profiles or assignments.
begin;
create or replace function public.save_admin_professional(
  requested_id uuid, payload jsonb, specialty_ids uuid[],
  expected_updated_at timestamptz default null, confirm_impact boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.professionals%rowtype; selected uuid[]; primary_id uuid;
  active boolean; existing boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode='42501',message='admin_required'; end if;
  if requested_id is null then raise exception using errcode='22023',message='invalid_id'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_id::text, 43));
  select * into previous from public.professionals where id=requested_id for update;
  existing := found;
  if existing and (expected_updated_at is null or previous.updated_at is distinct from expected_updated_at) then
    raise exception using errcode='40001',message='stale_professional';
  end if;
  if not existing and expected_updated_at is not null then raise exception using errcode='P0002',message='professional_missing'; end if;
  primary_id := (payload->>'specialty_id')::uuid;
  active := coalesce((payload->>'is_active')::boolean,false);
  select array_agg(distinct id) into selected from unnest(array_append(coalesce(specialty_ids,'{}'::uuid[]),primary_id)) id;
  if primary_id is null or cardinality(selected)>100 or exists(
    select 1 from unnest(selected) as requested(specialty_id) where not exists(
      select 1 from public.specialties s where s.id=requested.specialty_id and s.is_active)
  ) then raise exception using errcode='23514',message='invalid_specialties'; end if;
  if length(btrim(coalesce(payload->>'full_name','')))<2 or length(payload->>'full_name')>100
    or length(coalesce(payload->>'public_name',''))>100 or length(coalesce(payload->>'phone',''))>40
    or length(coalesce(payload->>'bio',''))>1400 or length(coalesce(payload->>'internal_notes',''))>1400
    or coalesce((payload->>'display_order')::int,-1) not between 0 and 999 then
    raise exception using errcode='23514',message='invalid_fields';
  end if;
  -- Never silently invalidate a currently assigned treatment by removing its specialty.
  if exists(select 1 from public.treatments t where not(t.specialty_id=any(selected)) and
    (t.professional_id=requested_id or exists(select 1 from public.treatment_professionals tp
      where tp.treatment_id=t.id and tp.professional_id=requested_id and tp.is_active))) then
    raise exception using errcode='23514',message='specialty_in_use';
  end if;
  if existing and previous.is_active and not active and not confirm_impact and (
    exists(select 1 from public.treatment_professionals where professional_id=requested_id and is_active)
    or exists(select 1 from public.treatments where professional_id=requested_id)
    or exists(select 1 from public.bookings where professional_id=requested_id and ends_at>now()
      and status in ('pending','awaiting_deposit','confirmed'))
  ) then raise exception using errcode='23514',message='impact_confirmation_required'; end if;
  insert into public.professionals(id,specialty_id,full_name,public_name,phone,bio,internal_notes,is_active,display_order)
  values(requested_id,primary_id,btrim(payload->>'full_name'),nullif(payload->>'public_name',''),nullif(payload->>'phone',''),
    nullif(payload->>'bio',''),nullif(payload->>'internal_notes',''),active,(payload->>'display_order')::int)
  on conflict(id) do update set specialty_id=excluded.specialty_id,full_name=excluded.full_name,
    public_name=excluded.public_name,phone=excluded.phone,bio=excluded.bio,internal_notes=excluded.internal_notes,
    is_active=excluded.is_active,display_order=excluded.display_order,updated_at=clock_timestamp();
  delete from public.professional_specialties where professional_id=requested_id;
  insert into public.professional_specialties(professional_id,specialty_id) select requested_id,unnest(selected);
  return requested_id;
end $$;
revoke all on function public.save_admin_professional(uuid,jsonb,uuid[],timestamptz,boolean) from public,anon;
grant execute on function public.save_admin_professional(uuid,jsonb,uuid[],timestamptz,boolean) to authenticated;
commit;
