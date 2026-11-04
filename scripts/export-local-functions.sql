select coalesce(
  jsonb_pretty(
    jsonb_agg(
      jsonb_build_object(
        'language', language.lanname,
        'definition', pg_get_functiondef(procedure.oid),
        'object_key', schema.nspname || '.' || procedure.proname || '(' || pg_get_function_identity_arguments(procedure.oid) || ')',
        'volatility', procedure.provolatile,
        'result_type', pg_get_function_result(procedure.oid),
        'schema_name', schema.nspname,
        'function_name', procedure.proname,
        'security_definer', procedure.prosecdef,
        'identity_arguments', pg_get_function_identity_arguments(procedure.oid)
      )
      order by schema.nspname, procedure.proname, pg_get_function_identity_arguments(procedure.oid)
    )
  ),
  '[]'
)
from pg_proc as procedure
join pg_namespace as schema on schema.oid = procedure.pronamespace
join pg_language as language on language.oid = procedure.prolang
where schema.nspname in ('public', 'private')
  and procedure.prokind = 'f';
