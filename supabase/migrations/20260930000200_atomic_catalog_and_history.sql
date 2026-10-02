-- Audit sprint A. No updates of existing client content during migration.
begin;

create or replace function public.save_treatment_professional_assignments(
  requested_treatment_id uuid, requested_professional_ids uuid[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.treatments%rowtype; selected_id uuid; position integer := 0;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  select * into t from public.treatments where id = requested_treatment_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'treatment_not_found'; end if;
  if cardinality(coalesce(requested_professional_ids,'{}'::uuid[])) > 100 then
    raise exception using errcode = '22023', message = 'too_many_professionals';
  end if;
  foreach selected_id in array coalesce(requested_professional_ids,'{}'::uuid[]) loop
    if not exists (
      select 1 from public.professionals p where p.id = selected_id and (p.is_active or not t.is_active)
      and (p.specialty_id = t.specialty_id or exists (
        select 1 from public.professional_specialties ps where ps.professional_id = p.id and ps.specialty_id = t.specialty_id
      ))
    ) then raise exception using errcode = '23514', message = 'professional_specialty_mismatch'; end if;
  end loop;
  if t.is_active and t.requires_professional_assignment and not exists (
    select 1 from public.professionals p where p.id = any(requested_professional_ids) and p.is_active
  ) then raise exception using errcode = '23514', message = 'published_treatment_requires_active_professional'; end if;
  update public.treatment_professionals set is_active = false where treatment_id = t.id;
  foreach selected_id in array coalesce(requested_professional_ids,'{}'::uuid[]) loop
    insert into public.treatment_professionals(treatment_id,professional_id,is_active,display_order)
    values(t.id,selected_id,true,position)
    on conflict(treatment_id,professional_id) do update set is_active = true,display_order = excluded.display_order,updated_at = now();
    position := position + 1;
  end loop;
end;
$$;
revoke all on function public.save_treatment_professional_assignments(uuid,uuid[]) from public,anon;
grant execute on function public.save_treatment_professional_assignments(uuid,uuid[]) to authenticated;

create or replace function public.save_admin_treatment(
  requested_treatment_id uuid, requested_values jsonb, requested_professional_ids uuid[],
  requested_is_new boolean, expected_updated_at timestamptz default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_row public.treatments%rowtype;
  desired public.treatments%rowtype;
  publish boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if requested_treatment_id is null or requested_is_new is null or jsonb_typeof(requested_values) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_treatment_payload';
  end if;
  -- Allow fields, not arbitrary SQL or client-supplied identity/audit timestamps.
  if exists (select 1 from jsonb_object_keys(requested_values) k where k <> all(array[
    'category_id','specialty_id','professional_id','requires_professional_assignment','name','slug',
    'short_description','description','expectations','characteristics','duration_minutes','buffer_minutes',
    'start_interval_minutes','selection_mode','price_cents','preparation','contraindications','image_path',
    'image_alt','image_focal_x','image_focal_y','is_active','display_order'
  ])) then raise exception using errcode = '22023', message = 'invalid_treatment_fields'; end if;
  perform pg_advisory_xact_lock(hashtextextended('treatment:' || requested_treatment_id::text,0));
  select * into current_row from public.treatments where id = requested_treatment_id for update;
  if requested_is_new and found then
    raise exception using errcode = '23505', message = 'treatment_already_exists';
  elsif not requested_is_new and not found then
    raise exception using errcode = 'P0002', message = 'treatment_not_found';
  elsif not requested_is_new and (expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at) then
    raise exception using errcode = '40001', message = 'treatment_version_conflict';
  end if;
  desired := jsonb_populate_record(current_row,requested_values);
  desired.professional_id := requested_professional_ids[1];
  publish := coalesce(desired.is_active,false);
  if desired.image_path is distinct from current_row.image_path and desired.image_path is not null and not exists (
    select 1 from public.treatment_media_uploads u where u.treatment_id = requested_treatment_id
      and u.user_id = auth.uid() and u.final_path = desired.image_path and u.status = 'finalized'
  ) then raise exception using errcode = '23514', message = 'treatment_media_not_owned'; end if;
  if publish and (char_length(trim(desired.short_description)) < 10 or char_length(trim(desired.description)) < 20) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_description';
  end if;
  -- Stage inactive inside this transaction only. Readers see the old state until commit.
  if requested_is_new then
    insert into public.treatments(id,category_id,specialty_id,professional_id,requires_professional_assignment,
      name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,
      start_interval_minutes,selection_mode,price_cents,preparation,contraindications,image_path,image_alt,
      image_focal_x,image_focal_y,is_active,display_order)
    values(requested_treatment_id,desired.category_id,desired.specialty_id,desired.professional_id,desired.requires_professional_assignment,
      desired.name,desired.slug,desired.short_description,desired.description,desired.expectations,desired.characteristics,
      desired.duration_minutes,desired.buffer_minutes,desired.start_interval_minutes,desired.selection_mode,desired.price_cents,
      desired.preparation,desired.contraindications,desired.image_path,desired.image_alt,desired.image_focal_x,desired.image_focal_y,false,desired.display_order);
  else
    update public.treatments set category_id = desired.category_id,specialty_id = desired.specialty_id,
      professional_id = desired.professional_id,requires_professional_assignment = desired.requires_professional_assignment,
      name = desired.name,short_description = desired.short_description,description = desired.description,
      expectations = desired.expectations,characteristics = desired.characteristics,duration_minutes = desired.duration_minutes,
      buffer_minutes = desired.buffer_minutes,start_interval_minutes = desired.start_interval_minutes,selection_mode = desired.selection_mode,
      price_cents = desired.price_cents,preparation = desired.preparation,contraindications = desired.contraindications,
      image_path = desired.image_path,image_alt = desired.image_alt,image_focal_x = desired.image_focal_x,
      image_focal_y = desired.image_focal_y,is_active = false,display_order = desired.display_order
    where id = requested_treatment_id;
  end if;
  perform public.save_treatment_professional_assignments(requested_treatment_id,requested_professional_ids);
  if publish then
    if exists (select 1 from public.professionals p where p.id = any(requested_professional_ids) and not p.is_active) then
      raise exception using errcode = '23514', message = 'professional_not_available';
    end if;
    update public.treatments set is_active = true where id = requested_treatment_id;
  end if;
  return requested_treatment_id;
end;
$$;
revoke all on function public.save_admin_treatment(uuid,jsonb,uuid[],boolean,timestamptz) from public,anon;
grant execute on function public.save_admin_treatment(uuid,jsonb,uuid[],boolean,timestamptz) to authenticated;

-- Keep the existing allowlisted restore implementation, but make it inaccessible
-- except through the version-checked wrapper. Safe to reapply this migration.
do $$ begin
  if to_regprocedure('private.restore_admin_audit_record(bigint,text)') is null then
    alter function public.restore_admin_audit_record(bigint,text) set schema private;
  end if;
end $$;
revoke all on function private.restore_admin_audit_record(bigint,text) from public,anon,authenticated;

create or replace function public.restore_admin_audit_record(requested_audit_id bigint,restore_reason text)
returns table(restored_table text,restored_record_id uuid,restored_action text)
language plpgsql security definer set search_path = '' as $$
declare a public.audit_log%rowtype; live jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if char_length(trim(coalesce(restore_reason,''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'restore_reason_required';
  end if;
  select * into a from public.audit_log where id = requested_audit_id
    and table_name in ('treatments','professionals') and action in ('update','delete');
  if not found then raise exception using errcode = '22023', message = 'audit_record_not_restorable'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    (case when a.table_name = 'treatments' then 'treatment:' else 'professional:' end) || a.record_id::text,0));
  if a.table_name = 'treatments' then
    select to_jsonb(t) into live from public.treatments t where t.id = a.record_id for update;
  else
    select to_jsonb(p) into live from public.professionals p where p.id = a.record_id for update;
  end if;
  if (a.action = 'update' and live is distinct from a.new_data)
    or (a.action = 'delete' and live is not null)
    or exists (select 1 from public.audit_log newer where newer.table_name = a.table_name
      and newer.record_id = a.record_id and newer.id > a.id) then
    raise exception using errcode = '40001', message = 'restore_version_conflict';
  end if;
  return query select * from private.restore_admin_audit_record(requested_audit_id,restore_reason);
end;
$$;
revoke all on function public.restore_admin_audit_record(bigint,text) from public,anon;
grant execute on function public.restore_admin_audit_record(bigint,text) to authenticated;
commit;
