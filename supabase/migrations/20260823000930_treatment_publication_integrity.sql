-- Urgent client catalog delivery: keep drafts flexible while making publication
-- rules authoritative in PostgreSQL.

create or replace function public.validate_treatment_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.is_active then
    return new;
  end if;

  if new.price_cents <= 0 then
    raise exception using errcode = '23514', message = 'published_treatment_requires_positive_price';
  end if;

  if nullif(trim(coalesce(new.image_path, '')), '') is null
    or char_length(trim(coalesce(new.image_alt, ''))) < 3 then
    raise exception using errcode = '23514', message = 'published_treatment_requires_accessible_image';
  end if;

  if not exists (
    select 1
    from public.treatment_categories as category
    where category.id = new.category_id
      and category.is_active
  ) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_category';
  end if;

  if not exists (
    select 1
    from public.specialties as specialty
    where specialty.id = new.specialty_id
      and specialty.is_active
  ) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_specialty';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_treatment_publication()
  from public, anon, authenticated;

drop trigger if exists treatments_validate_publication on public.treatments;
create trigger treatments_validate_publication
before insert or update of
  is_active,
  category_id,
  specialty_id,
  price_cents,
  image_path,
  image_alt
on public.treatments
for each row
execute function public.validate_treatment_publication();
