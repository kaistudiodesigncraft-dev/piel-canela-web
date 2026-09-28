-- Operational history and controlled restore for catalog entities.
-- Additive: keeps existing audit_log rows and does not transform business data.

begin;

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
      nullif(coalesce(
        row_data->>'id',
        row_data->>'user_id',
        row_data->>'professional_id',
        row_data->>'treatment_id'
      ), '')::uuid,
      lower(tg_op),
      old_snapshot,
      new_snapshot
    );
  end if;
  return coalesce(new, old);
end;
$$;

drop policy if exists operational_read_recoverable_audit on public.audit_log;
create policy operational_read_recoverable_audit
  on public.audit_log
  for select to authenticated
  using (
    public.is_admin()
    and table_name in (
      'treatments',
      'professionals',
      'professional_specialties',
      'treatment_professionals'
    )
  );

drop trigger if exists professional_specialties_audit on public.professional_specialties;
create trigger professional_specialties_audit
after insert or update or delete on public.professional_specialties
for each row execute function public.capture_admin_audit();

drop trigger if exists treatment_professionals_audit on public.treatment_professionals;
create trigger treatment_professionals_audit
after insert or update or delete on public.treatment_professionals
for each row execute function public.capture_admin_audit();

create or replace function public.text_array_from_jsonb(value jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(select jsonb_array_elements_text(value)), '{}'::text[]);
$$;

revoke all on function public.text_array_from_jsonb(jsonb) from public, anon, authenticated;

create or replace function public.restore_admin_audit_record(
  requested_audit_id bigint,
  restore_reason text
)
returns table (restored_table text, restored_record_id uuid, restored_action text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_audit public.audit_log%rowtype;
  snapshot jsonb;
  selected_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if restore_reason is null or char_length(trim(restore_reason)) < 3 then
    raise exception using errcode = '22023', message = 'restore_reason_required';
  end if;

  select *
    into selected_audit
  from public.audit_log
  where id = requested_audit_id
    and table_name in ('treatments', 'professionals')
    and action in ('update', 'delete')
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'audit_record_not_restorable';
  end if;

  snapshot := selected_audit.old_data;
  selected_id := selected_audit.record_id;

  if snapshot is null or selected_id is null then
    raise exception using errcode = '22023', message = 'restore_snapshot_missing';
  end if;

  if selected_audit.table_name = 'treatments' then
    if nullif(snapshot->>'image_path', '') is not null
      and left(snapshot->>'image_path', 1) <> '/'
      and left(snapshot->>'image_path', 8) <> 'https://'
      and not exists (
        select 1
        from storage.objects
        where bucket_id = 'treatment-media'
          and name = snapshot->>'image_path'
      ) then
      snapshot := jsonb_set(snapshot, '{image_path}', 'null'::jsonb, true);
      snapshot := jsonb_set(snapshot, '{image_alt}', 'null'::jsonb, true);
      snapshot := jsonb_set(snapshot, '{is_active}', 'false'::jsonb, true);
    end if;

    if selected_audit.action = 'update' then
      update public.treatments
      set
        category_id = (snapshot->>'category_id')::uuid,
        specialty_id = (snapshot->>'specialty_id')::uuid,
        professional_id = nullif(snapshot->>'professional_id', '')::uuid,
        requires_professional_assignment = coalesce((snapshot->>'requires_professional_assignment')::boolean, true),
        name = snapshot->>'name',
        slug = snapshot->>'slug',
        short_description = snapshot->>'short_description',
        description = snapshot->>'description',
        expectations = public.text_array_from_jsonb(coalesce(snapshot->'expectations', '[]'::jsonb)),
        characteristics = public.text_array_from_jsonb(coalesce(snapshot->'characteristics', '[]'::jsonb)),
        duration_minutes = (snapshot->>'duration_minutes')::integer,
        buffer_minutes = (snapshot->>'buffer_minutes')::integer,
        start_interval_minutes = coalesce((snapshot->>'start_interval_minutes')::integer, start_interval_minutes),
        selection_mode = coalesce(snapshot->>'selection_mode', selection_mode),
        price_cents = (snapshot->>'price_cents')::integer,
        preparation = snapshot->>'preparation',
        contraindications = snapshot->>'contraindications',
        image_path = snapshot->>'image_path',
        image_alt = snapshot->>'image_alt',
        image_focal_x = coalesce((snapshot->>'image_focal_x')::numeric, image_focal_x),
        image_focal_y = coalesce((snapshot->>'image_focal_y')::numeric, image_focal_y),
        is_active = (snapshot->>'is_active')::boolean,
        display_order = (snapshot->>'display_order')::integer
      where id = selected_id;

      if not found then
        raise exception using errcode = 'P0002', message = 'treatment_missing';
      end if;
    else
      if exists (select 1 from public.treatments where id = selected_id) then
        raise exception using errcode = '23505', message = 'treatment_already_exists';
      end if;

      insert into public.treatments (
        id, category_id, specialty_id, professional_id, requires_professional_assignment,
        name, slug, short_description, description, expectations, characteristics,
        duration_minutes, buffer_minutes, start_interval_minutes, selection_mode,
        price_cents, preparation, contraindications, image_path, image_alt,
        image_focal_x, image_focal_y, is_active, display_order
      )
      values (
        selected_id,
        (snapshot->>'category_id')::uuid,
        (snapshot->>'specialty_id')::uuid,
        nullif(snapshot->>'professional_id', '')::uuid,
        coalesce((snapshot->>'requires_professional_assignment')::boolean, true),
        snapshot->>'name',
        snapshot->>'slug',
        snapshot->>'short_description',
        snapshot->>'description',
        public.text_array_from_jsonb(coalesce(snapshot->'expectations', '[]'::jsonb)),
        public.text_array_from_jsonb(coalesce(snapshot->'characteristics', '[]'::jsonb)),
        (snapshot->>'duration_minutes')::integer,
        (snapshot->>'buffer_minutes')::integer,
        coalesce((snapshot->>'start_interval_minutes')::integer, 30),
        coalesce(snapshot->>'selection_mode', 'simple'),
        (snapshot->>'price_cents')::integer,
        snapshot->>'preparation',
        snapshot->>'contraindications',
        snapshot->>'image_path',
        snapshot->>'image_alt',
        coalesce((snapshot->>'image_focal_x')::numeric, 0.5),
        coalesce((snapshot->>'image_focal_y')::numeric, 0.5),
        (snapshot->>'is_active')::boolean,
        (snapshot->>'display_order')::integer
      );
    end if;
  elsif selected_audit.table_name = 'professionals' then
    if selected_audit.action = 'update' then
      update public.professionals
      set
        specialty_id = (snapshot->>'specialty_id')::uuid,
        full_name = snapshot->>'full_name',
        public_name = snapshot->>'public_name',
        phone = snapshot->>'phone',
        bio = snapshot->>'bio',
        internal_notes = snapshot->>'internal_notes',
        is_active = (snapshot->>'is_active')::boolean,
        display_order = (snapshot->>'display_order')::integer
      where id = selected_id;

      if not found then
        raise exception using errcode = 'P0002', message = 'professional_missing';
      end if;

      insert into public.professional_specialties(professional_id, specialty_id)
      values (selected_id, (snapshot->>'specialty_id')::uuid)
      on conflict do nothing;
    else
      if exists (select 1 from public.professionals where id = selected_id) then
        raise exception using errcode = '23505', message = 'professional_already_exists';
      end if;

      insert into public.professionals (
        id, specialty_id, full_name, public_name, phone, bio,
        internal_notes, is_active, display_order
      )
      values (
        selected_id,
        (snapshot->>'specialty_id')::uuid,
        snapshot->>'full_name',
        snapshot->>'public_name',
        snapshot->>'phone',
        snapshot->>'bio',
        snapshot->>'internal_notes',
        (snapshot->>'is_active')::boolean,
        (snapshot->>'display_order')::integer
      );

      insert into public.professional_specialties(professional_id, specialty_id)
      values (selected_id, (snapshot->>'specialty_id')::uuid)
      on conflict do nothing;
    end if;
  end if;

  insert into public.audit_log(actor_id, table_name, record_id, action, old_data, new_data)
  values (
    auth.uid(),
    'audit_log',
    selected_id,
    'insert',
    null,
    jsonb_build_object(
      'restored_audit_id', selected_audit.id,
      'restored_table', selected_audit.table_name,
      'restored_action', selected_audit.action,
      'reason', trim(restore_reason)
    )
  );

  return query select selected_audit.table_name, selected_id, selected_audit.action;
end;
$$;

revoke all on function public.restore_admin_audit_record(bigint, text) from public, anon;
grant execute on function public.restore_admin_audit_record(bigint, text) to authenticated;

commit;
