-- Sprint 2: catalog and professional integrity.

create unique index if not exists professionals_specialty_name_unique_idx
  on public.professionals (specialty_id, lower(trim(full_name)));

create index if not exists bookings_treatment_future_idx
  on public.bookings (treatment_id, starts_at, status);

create or replace function public.validate_treatment_professional_specialty()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  professional_specialty_id uuid;
  professional_is_active boolean;
begin
  if new.professional_id is null then
    return new;
  end if;

  select specialty_id, is_active
  into professional_specialty_id, professional_is_active
  from public.professionals
  where id = new.professional_id;

  if not found or professional_specialty_id <> new.specialty_id then
    raise exception using errcode = '23514', message = 'professional_specialty_mismatch';
  end if;

  if new.is_active and not professional_is_active then
    raise exception using errcode = '23514', message = 'inactive_professional_cannot_publish_treatment';
  end if;

  return new;
end;
$$;

drop trigger if exists treatments_validate_professional_specialty on public.treatments;
create trigger treatments_validate_professional_specialty
before insert or update of professional_id, specialty_id, is_active
on public.treatments
for each row execute function public.validate_treatment_professional_specialty();

revoke all on function public.validate_treatment_professional_specialty() from public, anon, authenticated;
