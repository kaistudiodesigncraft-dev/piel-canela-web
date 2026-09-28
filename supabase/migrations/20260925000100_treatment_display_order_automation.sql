-- Treatment display order hardening.
--
-- This migration intentionally touches only public.treatments.display_order:
-- - existing treatments are renumbered inside their current category;
-- - new treatments inserted with 0/null order are appended to their category;
-- - no treatments, bookings, professionals, combos, media, or slugs are deleted
--   or transformed.

begin;

with ordered_treatments as (
  select
    t.id,
    row_number() over (
      partition by t.category_id
      order by
        t.display_order asc,
        coalesce(s.display_order, 999999) asc,
        coalesce(s.name, '') asc,
        t.name asc,
        t.created_at asc,
        t.id asc
    )::integer as next_display_order
  from public.treatments t
  left join public.specialties s on s.id = t.specialty_id
)
update public.treatments t
set display_order = ordered_treatments.next_display_order
from ordered_treatments
where t.id = ordered_treatments.id
  and t.display_order is distinct from ordered_treatments.next_display_order;

create or replace function public.assign_treatment_display_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.display_order is null or new.display_order <= 0 then
    -- Serialize automatic ordering per category so simultaneous inserts cannot
    -- read the same max(display_order).
    perform pg_advisory_xact_lock(hashtextextended('treatments:display_order:' || new.category_id::text, 0));

    select coalesce(max(t.display_order), 0) + 1
      into new.display_order
    from public.treatments t
    where t.category_id = new.category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists treatments_assign_display_order on public.treatments;

create trigger treatments_assign_display_order
before insert on public.treatments
for each row
execute function public.assign_treatment_display_order();

comment on function public.assign_treatment_display_order() is
  'Assigns the next display_order inside a treatment category when new treatments are inserted with order 0 or null.';

commit;
