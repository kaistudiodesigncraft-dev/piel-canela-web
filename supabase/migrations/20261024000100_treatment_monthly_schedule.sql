-- Treatment-level recurring schedules. Existing treatments remain weekly.
-- Additive and safe to reapply; no existing catalog or booking rows are rewritten.
begin;

alter table public.treatments
  add column if not exists service_frequency text not null default 'weekly',
  add column if not exists monthly_weekday smallint,
  add column if not exists monthly_occurrence_ordinals smallint[] not null default '{}'::smallint[];

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'treatments_service_frequency_valid') then
    alter table public.treatments add constraint treatments_service_frequency_valid
      check (service_frequency in ('weekly', 'monthly'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'treatments_monthly_schedule_valid') then
    alter table public.treatments add constraint treatments_monthly_schedule_valid check (
      (service_frequency = 'weekly' and monthly_weekday is null and cardinality(monthly_occurrence_ordinals) = 0)
      or
      (service_frequency = 'monthly'
        and monthly_weekday between 0 and 6
        and cardinality(monthly_occurrence_ordinals) between 1 and 5
        and monthly_occurrence_ordinals <@ array[-1,1,2,3,4]::smallint[]
        and not (4::smallint = any(monthly_occurrence_ordinals) and -1::smallint = any(monthly_occurrence_ordinals)))
    );
  end if;
end $$;

grant select (service_frequency, monthly_weekday, monthly_occurrence_ordinals)
  on public.treatments to anon, authenticated;

create or replace function public.is_treatment_offered_on_date(
  requested_treatment_id uuid,
  requested_date date
) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when treatment.service_frequency = 'weekly' then true
      when treatment.service_frequency = 'monthly' then
        extract(dow from requested_date)::smallint = treatment.monthly_weekday
        and (
          (((extract(day from requested_date)::integer - 1) / 7) + 1)::smallint
            = any(treatment.monthly_occurrence_ordinals)
          or (
            -1::smallint = any(treatment.monthly_occurrence_ordinals)
            and date_trunc('month', requested_date + 7)::date
              > date_trunc('month', requested_date)::date
          )
        )
      else false
    end
    from public.treatments treatment
    where treatment.id = requested_treatment_id and treatment.is_active
  ), false);
$$;

revoke all on function public.is_treatment_offered_on_date(uuid,date) from public;
grant execute on function public.is_treatment_offered_on_date(uuid,date) to anon, authenticated;

create or replace function public.enforce_treatment_service_date()
returns trigger language plpgsql security definer set search_path = '' as $$
declare local_date date;
begin
  select (new.starts_at at time zone settings.timezone)::date into local_date
  from public.business_settings settings where settings.singleton;
  if not public.is_treatment_offered_on_date(new.treatment_id, local_date) then
    raise exception using errcode = '23514', message = 'treatment_not_offered_on_date';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_treatment_service_date on public.bookings;
create trigger bookings_treatment_service_date
before insert or update of treatment_id, starts_at on public.bookings
for each row execute function public.enforce_treatment_service_date();

create or replace function public.get_available_dates_for_selection_v2(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_from_date date,
  requested_to_date date,
  requested_extra_ids uuid[] default '{}'::uuid[]
) returns table (available_date date)
language plpgsql volatile security definer set search_path = '' as $$
begin
  if requested_from_date is null or requested_to_date is null
    or requested_to_date < requested_from_date
    or requested_to_date > requested_from_date + 366 then
    raise exception using errcode = '22023', message = 'invalid_date_range';
  end if;
  return query
  select candidate.day::date
  from generate_series(requested_from_date, requested_to_date, interval '1 day') candidate(day)
  where public.is_treatment_offered_on_date(requested_treatment_id, candidate.day::date)
    and exists (
      select 1 from public.get_available_slots_for_selection_v2(
        requested_treatment_id, requested_combo_id, candidate.day::date, requested_extra_ids
      ) limit 1
    )
  order by candidate.day;
end;
$$;

create or replace function public.get_available_dates_for_zone_order(
  payload text,
  signature text,
  requested_from_date date,
  requested_to_date date
) returns table (available_date date)
language plpgsql volatile security definer set search_path = '' as $$
declare verified jsonb; treatment_id uuid;
begin
  if requested_from_date is null or requested_to_date is null
    or requested_to_date < requested_from_date
    or requested_to_date > requested_from_date + 366 then
    raise exception using errcode = '22023', message = 'invalid_date_range';
  end if;
  verified := private.verify_depilation_quote(payload, signature);
  treatment_id := (verified->'context'->>'treatmentId')::uuid;
  return query
  select candidate.day::date
  from generate_series(requested_from_date, requested_to_date, interval '1 day') candidate(day)
  where public.is_treatment_offered_on_date(treatment_id, candidate.day::date)
    and exists (
      select 1 from public.get_available_slots_for_zone_order(payload, signature, candidate.day::date) limit 1
    )
  order by candidate.day;
end;
$$;

revoke all on function public.get_available_dates_for_selection_v2(uuid,uuid,date,date,uuid[]) from public;
revoke all on function public.get_available_dates_for_zone_order(text,text,date,date) from public;
grant execute on function public.get_available_dates_for_selection_v2(uuid,uuid,date,date,uuid[]) to anon,authenticated;
grant execute on function public.get_available_dates_for_zone_order(text,text,date,date) to anon,authenticated;

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

-- Rollback (only if this release has not stored monthly schedules):
-- begin;
-- drop trigger if exists bookings_treatment_service_date on public.bookings;
-- drop function if exists public.enforce_treatment_service_date();
-- drop function if exists public.is_treatment_offered_on_date(uuid,date);
-- alter table public.treatments drop constraint if exists treatments_monthly_schedule_valid;
-- alter table public.treatments drop constraint if exists treatments_service_frequency_valid;
-- alter table public.treatments drop column if exists monthly_occurrence_ordinals;
-- alter table public.treatments drop column if exists monthly_weekday;
-- alter table public.treatments drop column if exists service_frequency;
-- commit;
