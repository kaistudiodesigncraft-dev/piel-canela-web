-- Reverts only the HTTP classification introduced by 20261110000100.
-- It restores the exact function behavior that preceded that migration.
begin;

create or replace function public.save_admin_treatment(
  requested_treatment_id uuid, requested_values jsonb, requested_professional_ids uuid[],
  requested_is_new boolean, expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare current_row public.treatments%rowtype; desired public.treatments%rowtype; publish boolean;
begin
  if not public.is_admin(auth.uid()) then raise exception using errcode = '42501', message = 'admin_required'; end if;
  if requested_treatment_id is null or requested_is_new is null or jsonb_typeof(requested_values) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'invalid_treatment_payload';
  end if;
  if exists (select 1 from jsonb_object_keys(requested_values) k where k <> all(array[
    'category_id','specialty_id','professional_id','requires_professional_assignment','name','slug',
    'short_description','description','expectations','characteristics','duration_minutes','buffer_minutes',
    'start_interval_minutes','service_frequency','monthly_weekday','monthly_occurrence_ordinals',
    'selection_mode','price_cents','preparation','contraindications','image_path','image_alt','image_focal_x',
    'image_focal_y','is_active','display_order'
  ])) then raise exception using errcode = '22023', message = 'invalid_treatment_fields'; end if;
  perform pg_advisory_xact_lock(hashtextextended('treatment:' || requested_treatment_id::text,0));
  select * into current_row from public.treatments where id = requested_treatment_id for update;
  if requested_is_new and found then raise exception using errcode = '23505', message = 'treatment_already_exists';
  elsif not requested_is_new and not found then raise exception using errcode = 'P0002', message = 'treatment_not_found';
  elsif not requested_is_new and (expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at) then
    raise exception using errcode = '40001', message = 'treatment_version_conflict';
  end if;
  desired := jsonb_populate_record(current_row,requested_values);
  desired.professional_id := requested_professional_ids[1];
  publish := coalesce(desired.is_active,false);
  if desired.image_path is distinct from current_row.image_path and desired.image_path is not null and not exists (
    select 1 from public.treatment_media_uploads upload where upload.treatment_id = requested_treatment_id
      and upload.user_id = auth.uid() and upload.final_path = desired.image_path and upload.status = 'finalized'
  ) then raise exception using errcode = '23514', message = 'treatment_media_not_owned'; end if;
  if publish and (char_length(trim(desired.short_description)) < 10 or char_length(trim(desired.description)) < 20) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_description';
  end if;
  if requested_is_new then
    insert into public.treatments(id,category_id,specialty_id,professional_id,requires_professional_assignment,
      name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,
      start_interval_minutes,service_frequency,monthly_weekday,monthly_occurrence_ordinals,selection_mode,
      price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order)
    values(requested_treatment_id,desired.category_id,desired.specialty_id,desired.professional_id,desired.requires_professional_assignment,
      desired.name,desired.slug,desired.short_description,desired.description,desired.expectations,desired.characteristics,
      desired.duration_minutes,desired.buffer_minutes,desired.start_interval_minutes,desired.service_frequency,
      desired.monthly_weekday,desired.monthly_occurrence_ordinals,desired.selection_mode,desired.price_cents,
      desired.preparation,desired.contraindications,desired.image_path,desired.image_alt,desired.image_focal_x,
      desired.image_focal_y,false,desired.display_order);
  else
    update public.treatments set category_id=desired.category_id,specialty_id=desired.specialty_id,
      professional_id=desired.professional_id,requires_professional_assignment=desired.requires_professional_assignment,
      name=desired.name,short_description=desired.short_description,description=desired.description,
      expectations=desired.expectations,characteristics=desired.characteristics,duration_minutes=desired.duration_minutes,
      buffer_minutes=desired.buffer_minutes,start_interval_minutes=desired.start_interval_minutes,
      service_frequency=desired.service_frequency,monthly_weekday=desired.monthly_weekday,
      monthly_occurrence_ordinals=desired.monthly_occurrence_ordinals,selection_mode=desired.selection_mode,
      price_cents=desired.price_cents,preparation=desired.preparation,contraindications=desired.contraindications,
      image_path=desired.image_path,image_alt=desired.image_alt,image_focal_x=desired.image_focal_x,
      image_focal_y=desired.image_focal_y,is_active=false,display_order=desired.display_order
    where id=requested_treatment_id;
  end if;
  perform public.save_treatment_professional_assignments(requested_treatment_id,requested_professional_ids);
  if publish then
    if exists (select 1 from public.professionals professional where professional.id=any(requested_professional_ids) and not professional.is_active) then
      raise exception using errcode = '23514', message = 'professional_not_available';
    end if;
    update public.treatments set is_active=true where id=requested_treatment_id;
  end if;
  return requested_treatment_id;
end;
$$;

revoke all on function public.save_admin_treatment(uuid,jsonb,uuid[],boolean,timestamptz) from public,anon;
grant execute on function public.save_admin_treatment(uuid,jsonb,uuid[],boolean,timestamptz) to authenticated;

commit;
