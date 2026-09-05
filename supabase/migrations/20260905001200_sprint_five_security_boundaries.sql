-- Sprint 5: least-privilege treatment deletion, public column grants and
-- privacy-safe audit snapshots. Additive and data preserving.

-- Drafts may omit copy that is mandatory for publication. Identity and
-- operational ownership remain required so every draft is recoverable.
alter table public.treatments
  drop constraint if exists treatments_short_description_check,
  drop constraint if exists treatments_description_check;

alter table public.treatments
  add constraint treatments_short_description_check check (
    char_length(trim(short_description)) <= 240
    and (not is_active or char_length(trim(short_description)) >= 10)
  ),
  add constraint treatments_description_check check (
    char_length(trim(description)) <= 3000
    and (not is_active or char_length(trim(description)) >= 20)
  );

-- Keep the historical signature used by policies, but never allow callers to
-- inspect the role of an arbitrary UUID.
create or replace function public.is_admin(candidate_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_active
      and role in ('admin', 'manager')
  );
$$;

create or replace function public.is_owner(candidate_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and is_active
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

-- A manager may create and edit treatments, but permanent deletion must pass
-- through the guarded, relationally-safe operation below.
drop policy if exists admin_all_treatments on public.treatments;
drop policy if exists treatments_admin_select on public.treatments;
drop policy if exists treatments_admin_insert on public.treatments;
drop policy if exists treatments_admin_update on public.treatments;

create policy treatments_admin_select on public.treatments
  for select to authenticated using (public.is_admin());
create policy treatments_admin_insert on public.treatments
  for insert to authenticated with check (public.is_admin());
create policy treatments_admin_update on public.treatments
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke delete on public.treatments from authenticated;

create or replace function public.delete_treatment_if_unlinked(
  requested_treatment_id uuid,
  request_guard_secret text
)
returns table (slug text, image_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_guard_hash text;
  selected_slug text;
  selected_image_path text;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  select secret_hash into stored_guard_hash
  from private.booking_guard_config
  where singleton;

  if stored_guard_hash is null
    or request_guard_secret is null
    or char_length(request_guard_secret) < 32
    or encode(extensions.digest(request_guard_secret, 'sha256'), 'hex') <> stored_guard_hash then
    raise exception using errcode = '42501', message = 'deletion_guard_invalid';
  end if;

  select treatment.slug, treatment.image_path
    into selected_slug, selected_image_path
  from public.treatments as treatment
  where treatment.id = requested_treatment_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'treatment_not_found';
  end if;

  if exists (select 1 from public.bookings where treatment_id = requested_treatment_id)
    or exists (select 1 from public.monthly_specials where treatment_id = requested_treatment_id) then
    raise exception using errcode = '23503', message = 'treatment_has_history';
  end if;

  delete from public.treatments where id = requested_treatment_id;
  return query select selected_slug, selected_image_path;
end;
$$;

revoke all on function public.delete_treatment_if_unlinked(uuid, text)
  from public, anon;
grant execute on function public.delete_treatment_if_unlinked(uuid, text)
  to authenticated;

-- Final public media are immutable through the client API. New files still use
-- UUID names and upsert=false; replacement happens by changing the treatment
-- reference, never by overwriting an existing object.
drop policy if exists treatment_media_admin_update on storage.objects;
drop policy if exists treatment_media_admin_delete on storage.objects;

-- Public rendering needs only this explicit set. Internal actor UUIDs remain
-- available to authorized admin workflows through drafts/revisions.
revoke all on public.site_content from anon, authenticated;
grant select (
  key, section, label, kind, value, image_path, image_alt, display_order,
  focal_x, focal_y, presentation, surface_preset, overlay_preset, enabled,
  updated_at
) on public.site_content to anon, authenticated;

-- Status history is written by transition_admin_booking. Direct inserts could
-- otherwise forge an audit trail.
drop policy if exists admin_insert_booking_status_history on public.booking_status_history;
revoke insert on public.booking_status_history from authenticated;

-- Audit records retain operational evidence without persisting customer notes
-- or indirect customer identifiers.
create or replace function public.capture_admin_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  old_snapshot jsonb;
  new_snapshot jsonb;
begin
  if public.is_admin(auth.uid()) then
    old_snapshot := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
    new_snapshot := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;

    if tg_table_name = 'bookings' then
      old_snapshot := old_snapshot - array['customer_id', 'customer_notes', 'internal_notes'];
      new_snapshot := new_snapshot - array['customer_id', 'customer_notes', 'internal_notes'];
    end if;

    insert into public.audit_log(actor_id, table_name, record_id, action, old_data, new_data)
    values (
      auth.uid(),
      tg_table_name,
      nullif(coalesce(row_data->>'id', row_data->>'user_id'), '')::uuid,
      lower(tg_op),
      old_snapshot,
      new_snapshot
    );
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_admin_audit()
  from public, anon, authenticated;
