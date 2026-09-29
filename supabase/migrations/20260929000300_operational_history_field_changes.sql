begin;

drop function if exists public.list_operational_audit_history(integer);

create or replace function public.list_operational_audit_history(result_limit integer default 250)
returns table (
  id bigint,
  actor_id uuid,
  table_name text,
  record_id uuid,
  action text,
  changed_fields text[],
  field_changes jsonb,
  entity_reference text,
  is_restorable boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  return query
  with selected_audit as (
    select audit.*
    from public.audit_log as audit
    where audit.table_name in (
      'treatments',
      'professionals',
      'professional_specialties',
      'treatment_professionals'
    )
    order by audit.created_at desc
    limit greatest(1, least(coalesce(result_limit, 250), 500))
  ), changed as (
    select
      selected_audit.id,
      field_key,
      field_key in ('phone', 'email', 'customer_notes', 'internal_notes', 'deposit_text', 'cancellation_policy') as is_private
    from selected_audit
    cross join lateral (
      select jsonb_object_keys(coalesce(selected_audit.old_data, '{}'::jsonb)) as field_key
      union
      select jsonb_object_keys(coalesce(selected_audit.new_data, '{}'::jsonb)) as field_key
    ) as fields
    where field_key <> 'updated_at'
      and (
        selected_audit.action <> 'update'
        or coalesce(selected_audit.old_data -> field_key, 'null'::jsonb)
          is distinct from coalesce(selected_audit.new_data -> field_key, 'null'::jsonb)
      )
  )
  select
    selected_audit.id,
    selected_audit.actor_id,
    selected_audit.table_name,
    selected_audit.record_id,
    selected_audit.action,
    coalesce(array_agg(distinct changed.field_key order by changed.field_key) filter (where changed.field_key is not null), '{}'::text[]) as changed_fields,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'key', changed.field_key,
        'isPrivate', changed.is_private,
        'before', case when changed.is_private then null else selected_audit.old_data -> changed.field_key end,
        'after', case when changed.is_private then null else selected_audit.new_data -> changed.field_key end
      )
      order by changed.field_key
    ) filter (where changed.field_key is not null), '[]'::jsonb) as field_changes,
    nullif(coalesce(
      selected_audit.new_data ->> 'name',
      selected_audit.old_data ->> 'name',
      selected_audit.new_data ->> 'title',
      selected_audit.old_data ->> 'title',
      selected_audit.new_data ->> 'full_name',
      selected_audit.old_data ->> 'full_name',
      selected_audit.new_data ->> 'public_name',
      selected_audit.old_data ->> 'public_name'
    ), '') as entity_reference,
    (
      selected_audit.table_name in ('treatments', 'professionals')
      and selected_audit.action in ('update', 'delete')
      and selected_audit.old_data is not null
      and selected_audit.record_id is not null
    ) as is_restorable,
    selected_audit.created_at
  from selected_audit
  left join changed on changed.id = selected_audit.id
  group by selected_audit.id, selected_audit.actor_id, selected_audit.table_name, selected_audit.record_id,
    selected_audit.action, selected_audit.old_data, selected_audit.new_data, selected_audit.created_at
  order by selected_audit.created_at desc;
end;
$$;

revoke all on function public.list_operational_audit_history(integer) from public, anon;
grant execute on function public.list_operational_audit_history(integer) to authenticated;

commit;
