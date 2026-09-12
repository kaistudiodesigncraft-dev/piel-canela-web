-- Additive: no existing rows are modified. Existing RLS remains authoritative.
create or replace function public.search_admin_booking_ids(
  p_query text, p_starts_at timestamptz default null, p_ends_at timestamptz default null,
  p_status text default 'all', p_page integer default 1, p_page_size integer default 25,
  p_ascending boolean default true
) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if p_query is null or length(btrim(p_query)) < 1 or length(p_query) > 100
    or p_page is null or p_page < 1 or p_page > 10000
    or p_page_size is null or p_page_size < 1 or p_page_size > 50
    or p_status is null or p_status not in ('all','pending','awaiting_deposit','confirmed','cancelled','completed','no_show','expired')
    or (p_starts_at is not null and p_ends_at is not null and p_starts_at >= p_ends_at)
  then raise exception using errcode = '22023', message = 'invalid_search'; end if;
  with matches as materialized (
    select b.id, b.starts_at from public.bookings b
    join public.customers c on c.id = b.customer_id
    where (p_starts_at is null or b.starts_at >= p_starts_at)
      and (p_ends_at is null or b.starts_at < p_ends_at)
      and (p_status = 'all' or b.status::text = p_status)
      and (strpos(lower(b.booking_code), lower(btrim(p_query))) > 0
        or strpos(lower(c.full_name), lower(btrim(p_query))) > 0
        or strpos(c.phone, btrim(p_query)) > 0
        or (regexp_replace(p_query, '[^0-9]', '', 'g') <> ''
          and strpos(regexp_replace(c.phone, '[^0-9]', '', 'g'), regexp_replace(p_query, '[^0-9]', '', 'g')) > 0))
  ), page_rows as (
    select id, starts_at from matches
    order by case when p_ascending then starts_at end asc,
      case when not p_ascending then starts_at end desc, id
    limit p_page_size offset ((p_page - 1) * p_page_size)
  )
  select jsonb_build_object(
    'ids', coalesce((select jsonb_agg(id order by case when p_ascending then starts_at end asc, case when not p_ascending then starts_at end desc, id) from page_rows), '[]'::jsonb),
    'total', (select count(*) from matches)
  ) into result;
  return result;
end;
$$;
revoke all on function public.search_admin_booking_ids(text,timestamptz,timestamptz,text,integer,integer,boolean) from public, anon;
grant execute on function public.search_admin_booking_ids(text,timestamptz,timestamptz,text,integer,integer,boolean) to authenticated;
