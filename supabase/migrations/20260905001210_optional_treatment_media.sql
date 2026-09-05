-- Treatment media is intentionally independent from catalog authoring.
-- This additive migration allows reception to publish a complete treatment
-- while photography is pending. If an image is attached, accessible
-- alternative text remains mandatory.

alter table public.treatments
  drop constraint if exists treatment_publishable,
  drop constraint if exists treatment_image_accessible_when_present;

alter table public.treatments
  add constraint treatment_image_accessible_when_present check (
    nullif(trim(coalesce(image_path, '')), '') is null
    or char_length(trim(coalesce(image_alt, ''))) >= 3
  );

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

  if nullif(trim(coalesce(new.image_path, '')), '') is not null
    and char_length(trim(coalesce(new.image_alt, ''))) < 3 then
    raise exception using errcode = '23514', message = 'treatment_image_requires_accessible_description';
  end if;

  if not exists (
    select 1 from public.treatment_categories as category
    where category.id = new.category_id and category.is_active
  ) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_category';
  end if;

  if not exists (
    select 1 from public.specialties as specialty
    where specialty.id = new.specialty_id and specialty.is_active
  ) then
    raise exception using errcode = '23514', message = 'published_treatment_requires_active_specialty';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_treatment_publication() from public, anon;
grant execute on function public.validate_treatment_publication() to authenticated;
