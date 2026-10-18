-- Pending production approval. Only installs functions and permissions.
-- No existing row, relationship, RLS policy or media object is changed on apply.
begin;

create or replace function private.assert_catalog_removal_guard(request_guard_secret text)
returns void language plpgsql security definer set search_path = '' as $$
declare stored_guard_hash text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode='42501', message='admin_required';
  end if;
  select secret_hash into stored_guard_hash from private.booking_guard_config where singleton;
  if stored_guard_hash is null or request_guard_secret is null
    or char_length(request_guard_secret)<32
    or encode(extensions.digest(request_guard_secret,'sha256'),'hex')<>stored_guard_hash then
    raise exception using errcode='42501', message='deletion_guard_invalid';
  end if;
end;
$$;
revoke all on function private.assert_catalog_removal_guard(text) from public,anon,authenticated;

create or replace function public.remove_monthly_special_safely(
  requested_special_id uuid, expected_updated_at timestamptz, request_guard_secret text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare parent_id uuid; special public.monthly_specials%rowtype;
begin
  perform private.assert_catalog_removal_guard(request_guard_secret);
  select treatment_id into parent_id from public.monthly_specials where id=requested_special_id;
  if not found then raise exception using errcode='P0002',message='special_not_found'; end if;
  -- Lock parent before children, consistently with treatment removal.
  perform 1 from public.treatments where id=parent_id for update;
  select * into special from public.monthly_specials where id=requested_special_id for update;
  if not found then raise exception using errcode='P0002',message='special_not_found'; end if;
  if special.treatment_id<>parent_id or expected_updated_at is null
    or special.updated_at<>expected_updated_at then
    raise exception using errcode='40001',message='catalog_removal_stale';
  end if;
  if exists(select 1 from public.bookings where monthly_special_id=requested_special_id) then
    update public.monthly_specials set is_active=false where id=requested_special_id;
    return jsonb_build_object('outcome','archived','treatmentId',parent_id);
  end if;
  delete from public.monthly_specials where id=requested_special_id;
  return jsonb_build_object('outcome','deleted','treatmentId',parent_id);
end;
$$;

create or replace function public.remove_treatment_with_specials(
  requested_treatment_id uuid, requested_action text, replacement_treatment_id uuid,
  expected_updated_at timestamptz, expected_special_versions jsonb,
  request_guard_secret text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare treatment public.treatments%rowtype; target public.treatments%rowtype;
  special_count integer; expected_count integer;
begin
  perform private.assert_catalog_removal_guard(request_guard_secret);
  if requested_action is null or requested_action not in ('delete','reassign','archive') then
    raise exception using errcode='22023',message='removal_action_invalid';
  end if;
  if requested_action='reassign' and (replacement_treatment_id is null
    or replacement_treatment_id=requested_treatment_id) then
    raise exception using errcode='22023',message='replacement_treatment_required';
  end if;
  -- Consistent lock order avoids reciprocal reassignments deadlocking.
  perform 1 from public.treatments
    where id=requested_treatment_id
      or (requested_action='reassign' and id=replacement_treatment_id)
    order by id for update;
  select * into treatment from public.treatments where id=requested_treatment_id;
  if not found then raise exception using errcode='P0002',message='treatment_not_found'; end if;
  if expected_updated_at is null or treatment.updated_at<>expected_updated_at then
    raise exception using errcode='40001',message='catalog_removal_stale';
  end if;
  perform 1 from public.monthly_specials where treatment_id=requested_treatment_id order by id for update;
  select count(*) into special_count from public.monthly_specials where treatment_id=requested_treatment_id;
  if expected_special_versions is null or jsonb_typeof(expected_special_versions)<>'array' then
    raise exception using errcode='22023',message='special_versions_required';
  end if;
  expected_count:=jsonb_array_length(expected_special_versions);
  if expected_count<>special_count or exists (
    select 1 from jsonb_to_recordset(expected_special_versions) as expected(id uuid,"updatedAt" timestamptz)
    where not exists(select 1 from public.monthly_specials s where s.id=expected.id
      and s.treatment_id=requested_treatment_id and s.updated_at=expected."updatedAt")
  ) or (select count(distinct value->>'id') from jsonb_array_elements(expected_special_versions))<>expected_count then
    raise exception using errcode='40001',message='catalog_removal_stale';
  end if;

  if requested_action='archive' then
    -- Existing is_active is the established soft-archive mechanism.
    -- Historical bookings, snapshots, packages, combos and media are untouched.
    update public.monthly_specials set is_active=false where treatment_id=requested_treatment_id;
    update public.treatments set is_active=false where id=requested_treatment_id;
    return jsonb_build_object('outcome','archived','slug',treatment.slug,'specialCount',special_count);
  end if;
  if exists(select 1 from public.bookings where treatment_id=requested_treatment_id)
    or exists(select 1 from public.customer_packages where treatment_id=requested_treatment_id)
    or exists(select 1 from public.treatment_combos where treatment_id=requested_treatment_id)
    or exists(select 1 from public.bookings b join public.monthly_specials s on s.id=b.monthly_special_id
      where s.treatment_id=requested_treatment_id) then
    raise exception using errcode='23503',message='treatment_requires_archive';
  end if;
  if requested_action='reassign' then
    select * into target from public.treatments where id=replacement_treatment_id;
    if not found then raise exception using errcode='22023',message='replacement_treatment_required'; end if;
    if target.selection_mode<>treatment.selection_mode then
      raise exception using errcode='22023',message='replacement_treatment_incompatible';
    end if;
    -- Preserve texts, prices and dates, but require deliberate re-publication
    -- against the new treatment. Existing constraints still validate the move.
    update public.monthly_specials set treatment_id=replacement_treatment_id,is_active=false
      where treatment_id=requested_treatment_id;
  else
    delete from public.monthly_specials where treatment_id=requested_treatment_id;
  end if;
  -- Remaining FK restrictions are the final safety net. Every change above
  -- rolls back if this delete or any audit trigger fails.
  delete from public.treatments where id=requested_treatment_id;
  return jsonb_build_object('outcome','deleted','slug',treatment.slug,
    'specialCount',special_count,'specialAction',requested_action);
end;
$$;

revoke all on function public.remove_monthly_special_safely(uuid,timestamptz,text) from public,anon;
revoke all on function public.remove_treatment_with_specials(uuid,text,uuid,timestamptz,jsonb,text) from public,anon;
grant execute on function public.remove_monthly_special_safely(uuid,timestamptz,text) to authenticated;
grant execute on function public.remove_treatment_with_specials(uuid,text,uuid,timestamptz,jsonb,text) to authenticated;

commit;
