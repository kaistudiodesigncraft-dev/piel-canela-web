-- Compact availability and stable catalog grouping. Additive and safe to reapply.
begin;

alter table public.treatments add column if not exists catalog_group text not null default 'default';
alter table public.treatments add column if not exists is_combo boolean not null default false;
grant select (catalog_group,is_combo) on public.treatments to anon,authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'treatments_catalog_group_valid') then
    alter table public.treatments add constraint treatments_catalog_group_valid
      check (catalog_group in ('default','facial','brows_lashes','depilation'));
  end if;
end $$;

-- Explicit mapping: no names, slugs or existing display orders are rewritten.
update public.treatments set catalog_group = 'facial'
where id in (
  '30000000-0000-4000-8000-000000000001'::uuid,
  '6929cc34-625b-4169-aed1-49155e2aff55'::uuid,
  '82a73dc5-80c4-41b7-87be-dab39e7907c2'::uuid,
  '686a113e-fdd0-4fdc-b549-ec1e7af01552'::uuid,
  '86723ce1-f0ef-4240-bd5b-2d679b025f9e'::uuid,
  '60409fe3-fadc-486f-b220-6823ef8f4ecc'::uuid,
  'c4d06638-14d4-4e5e-b061-7f41af16493e'::uuid,
  'f82ca641-5f58-4bcf-b528-28e031b883eb'::uuid
);

update public.treatments set catalog_group = 'brows_lashes'
where id in (
  'b09f422d-70e8-4077-8354-74f3d04a0de1'::uuid,
  '8b85ed10-0441-4c3c-b410-e7b6a5a70772'::uuid,
  '3316938d-8eed-4dec-bd57-46e531d1c6ba'::uuid
);

update public.treatments set catalog_group = 'depilation'
where id = 'a1f1196c-ff98-4a7b-86d6-355d3273944b'::uuid;

update public.treatments set is_combo = true
where id in (
  'f105c05b-102a-41ba-9c59-d2e41a99ba53'::uuid,
  '13011857-0079-467c-8caf-e3e4cbbb56c1'::uuid,
  'b1db9d2f-43ac-4430-80a8-14bc4f1d547f'::uuid
);

create or replace function public.get_available_dates_for_selection_v2(
  requested_treatment_id uuid,
  requested_combo_id uuid,
  requested_from_date date,
  requested_to_date date,
  requested_extra_ids uuid[] default '{}'::uuid[]
)
returns table (available_date date)
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
  where exists (
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
)
returns table (available_date date)
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
  where exists (
    select 1 from public.get_available_slots_for_zone_order(payload, signature, candidate.day::date) limit 1
  )
  order by candidate.day;
end;
$$;

revoke all on function public.get_available_dates_for_selection_v2(uuid,uuid,date,date,uuid[]) from public;
revoke all on function public.get_available_dates_for_zone_order(text,text,date,date) from public;
grant execute on function public.get_available_dates_for_selection_v2(uuid,uuid,date,date,uuid[]) to anon,authenticated;
grant execute on function public.get_available_dates_for_zone_order(text,text,date,date) to anon,authenticated;

commit;
