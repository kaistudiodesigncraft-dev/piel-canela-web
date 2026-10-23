-- Reverses only this migration. Existing treatment identity, content and display_order are untouched.
begin;
drop function if exists public.get_available_dates_for_zone_order(text,text,date,date);
drop function if exists public.get_available_dates_for_selection_v2(uuid,uuid,date,date,uuid[]);
alter table public.treatments drop constraint if exists treatments_catalog_group_valid;
alter table public.treatments drop column if exists is_combo;
alter table public.treatments drop column if exists catalog_group;
commit;
