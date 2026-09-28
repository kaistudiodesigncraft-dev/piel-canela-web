-- Sanitized operational history for managers.
-- Keeps full audit snapshots inside the database for restore, but prevents the
-- day-to-day history UI from receiving old_data/new_data payloads.

begin;

drop policy if exists operational_read_recoverable_audit on public.audit_log;

create or replace function public.list_operational_audit_history(result_limit integer default 250)
returns table (
  id bigint,
  actor_id uuid,
  table_name text,
  record_id uuid,
  action text,
  changed_fields text[],
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
  )
  select
    selected_audit.id,
    selected_audit.actor_id,
    selected_audit.table_name,
    selected_audit.record_id,
    selected_audit.action,
    coalesce((
      select array_agg(distinct field_key order by field_key)
      from (
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
    ), '{}'::text[]) as changed_fields,
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
  from selected_audit;
end;
$$;

revoke all on function public.list_operational_audit_history(integer) from public, anon;
grant execute on function public.list_operational_audit_history(integer) to authenticated;

commit;
