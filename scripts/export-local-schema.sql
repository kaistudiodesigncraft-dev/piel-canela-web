\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

\o /tmp/columns.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(columns_row) order by table_name, ordinal_position)), '[]')
from (
  select
    udt_name,
    data_type,
    table_name,
    column_name,
    is_identity,
    is_nullable,
    is_generated,
    column_default,
    ordinal_position,
    identity_generation,
    generation_expression
  from information_schema.columns
  where table_schema = 'public'
) as columns_row;

\o /tmp/constraints.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(constraint_row) order by object_key)), '[]')
from (
  select
    pg_get_constraintdef(constraint_record.oid, true) as definition,
    schema.nspname || '.' || relation.relname || '.' || constraint_record.conname as object_key,
    relation.relname as table_name,
    schema.nspname as schema_name,
    constraint_record.conname as constraint_name,
    constraint_record.contype::text as constraint_type
  from pg_constraint as constraint_record
  join pg_class as relation on relation.oid = constraint_record.conrelid
  join pg_namespace as schema on schema.oid = relation.relnamespace
  where schema.nspname = 'public'
) as constraint_row;

\o /tmp/functions.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(function_row) order by object_key)), '[]')
from (
  select
    language.lanname as language,
    pg_get_functiondef(procedure.oid) as definition,
    schema.nspname || '.' || procedure.proname || '(' || pg_get_function_identity_arguments(procedure.oid) || ')' as object_key,
    procedure.provolatile::text as volatility,
    pg_get_function_result(procedure.oid) as result_type,
    schema.nspname as schema_name,
    procedure.proname as function_name,
    procedure.prosecdef as security_definer,
    pg_get_function_identity_arguments(procedure.oid) as identity_arguments
  from pg_proc as procedure
  join pg_namespace as schema on schema.oid = procedure.pronamespace
  join pg_language as language on language.oid = procedure.prolang
  where schema.nspname in ('public', 'private')
    and procedure.prokind = 'f'
) as function_row;

\o /tmp/policies.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(policy_row) order by object_key)), '[]')
from (
  select
    cmd,
    qual,
    roles,
    tablename,
    schemaname || '.' || tablename || '.' || policyname as object_key,
    permissive,
    policyname,
    schemaname,
    with_check
  from pg_policies
  where schemaname in ('public', 'private')
) as policy_row;

\o /tmp/function_grants.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(grant_row) order by object_key)), '[]')
from (
  select
    schema.nspname || '.' || procedure.proname || '(' || pg_get_function_identity_arguments(procedure.oid) || ')'
      || '::' || coalesce(grantee.rolname, 'PUBLIC') || '::' || privilege.privilege_type as object_key,
    schema.nspname || '.' || procedure.proname || '(' || pg_get_function_identity_arguments(procedure.oid) || ')' as function_key,
    procedure.prosecdef as security_definer,
    coalesce(grantee.rolname, 'PUBLIC') as grantee,
    privilege.privilege_type,
    privilege.is_grantable
  from pg_proc as procedure
  join pg_namespace as schema on schema.oid = procedure.pronamespace
  cross join lateral aclexplode(coalesce(procedure.proacl, acldefault('f', procedure.proowner))) as privilege
  left join pg_roles as grantee on grantee.oid = privilege.grantee
  where schema.nspname in ('public', 'private')
    and procedure.prokind = 'f'
) as grant_row;

\o /tmp/triggers.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(trigger_row) order by object_key)), '[]')
from (
  select
    trigger_record.tgenabled::text as enabled,
    pg_get_triggerdef(trigger_record.oid, true) as definition,
    schema.nspname || '.' || relation.relname || '.' || trigger_record.tgname as object_key,
    relation.relname as table_name,
    schema.nspname as schema_name,
    trigger_record.tgname as trigger_name
  from pg_trigger as trigger_record
  join pg_class as relation on relation.oid = trigger_record.tgrelid
  join pg_namespace as schema on schema.oid = relation.relnamespace
  where schema.nspname in ('public', 'private')
    and not trigger_record.tgisinternal
) as trigger_row;

\o /tmp/indexes.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(index_row) order by object_key)), '[]')
from (
  select
    schema.nspname || '.' || relation.relname || '.' || index_relation.relname as object_key,
    schema.nspname as schema_name,
    relation.relname as table_name,
    index_relation.relname as index_name,
    pg_get_indexdef(index_record.indexrelid) as definition
  from pg_index as index_record
  join pg_class as relation on relation.oid = index_record.indrelid
  join pg_class as index_relation on index_relation.oid = index_record.indexrelid
  join pg_namespace as schema on schema.oid = relation.relnamespace
  where schema.nspname = 'public'
) as index_row;

\o /tmp/tables_rls.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(table_row) order by object_key)), '[]')
from (
  select
    schema.nspname || '.' || relation.relname as object_key,
    schema.nspname as schema_name,
    relation.relname as table_name,
    relation.relrowsecurity as rls_enabled,
    relation.relforcerowsecurity as force_rls,
    owner.rolname as owner
  from pg_class as relation
  join pg_namespace as schema on schema.oid = relation.relnamespace
  join pg_roles as owner on owner.oid = relation.relowner
  where schema.nspname = 'public'
    and relation.relkind in ('r', 'p')
) as table_row;

\o /tmp/table_grants.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(grant_row) order by object_key)), '[]')
from (
  select
    schema.nspname || '.' || relation.relname || '::' || coalesce(grantee.rolname, 'PUBLIC') || '::' || privilege.privilege_type as object_key,
    schema.nspname as schema_name,
    relation.relname as table_name,
    coalesce(grantee.rolname, 'PUBLIC') as grantee,
    privilege.privilege_type,
    privilege.is_grantable
  from pg_class as relation
  join pg_namespace as schema on schema.oid = relation.relnamespace
  cross join lateral aclexplode(coalesce(relation.relacl, acldefault('r', relation.relowner))) as privilege
  left join pg_roles as grantee on grantee.oid = privilege.grantee
  where schema.nspname in ('public', 'private')
    and relation.relkind in ('r', 'p')
) as grant_row;

\o /tmp/column_grants.json
select coalesce(jsonb_pretty(jsonb_agg(to_jsonb(grant_row) order by object_key)), '[]')
from (
  select
    schema.nspname || '.' || relation.relname || '.' || attribute.attname
      || '::' || coalesce(grantee.rolname, 'PUBLIC') || '::' || privilege.privilege_type as object_key,
    schema.nspname as schema_name,
    relation.relname as table_name,
    attribute.attname as column_name,
    coalesce(grantee.rolname, 'PUBLIC') as grantee,
    privilege.privilege_type,
    privilege.is_grantable
  from pg_class as relation
  join pg_namespace as schema on schema.oid = relation.relnamespace
  join pg_attribute as attribute on attribute.attrelid = relation.oid
  cross join lateral aclexplode(attribute.attacl) as privilege
  left join pg_roles as grantee on grantee.oid = privilege.grantee
  where schema.nspname in ('public', 'private')
    and relation.relkind in ('r', 'p')
    and attribute.attnum > 0
    and not attribute.attisdropped
    and attribute.attacl is not null
) as grant_row;

\o
