# Contrato de respaldo del esquema efectivo

Desde H2, copiar únicamente migraciones o guardar hashes no se considera un
respaldo suficiente del esquema. Cada respaldo fresco debe consultar el catálogo
de la misma base que se está respaldando y conservar las definiciones completas.

## Archivos obligatorios

- `columns.json`: tipo, nulabilidad, identidad, generación y default desde
  `information_schema.columns`;
- `constraints.json`: `pg_get_constraintdef(..., true)`;
- `functions.json`: `pg_get_functiondef`, resultado, volatilidad,
  `SECURITY DEFINER`, argumentos e identidad para esquemas `public` y `private`;
- `function_grants.json`: ACL expandida mediante `aclexplode`, incluido
  `PUBLIC`, rol, privilegio y `is_grantable`;
- `policies.json`: comando, roles, modo permisivo, `qual` y `with_check` desde
  `pg_policies`;
- `triggers.json`: `pg_get_triggerdef(..., true)`, estado y relación;
- manifiesto con cantidad, bytes y SHA-256 de cada archivo.

Las consultas canónicas están en
`scripts/export-local-schema.sql`. Para producción deben ejecutarse mediante una
conexión administrativa de solo lectura o MCP SELECT-only, sin `COPY` del
servidor ni comandos de sistema. El resultado se guarda fuera de Git.

## Verificación obligatoria

El modo de vigilancia compara dos exportaciones obtenidas por el mismo método y
falla ante cualquier objeto agregado, modificado o eliminado:

```powershell
node --experimental-strip-types scripts/verify-baseline-v2.ts `
  --mode schema-watch `
  --reference-snapshot <respaldo-autorizado> `
  --snapshot <respaldo-fresco>
```

Una diferencia esperada por una migración revisada también genera alerta. Solo
se actualiza la referencia después de comprobar que coincide exactamente con la
migración aprobada. Una diferencia no explicada detiene cualquier despliegue.

Para comparar producción con una restauración local se usa `--mode
local-restore`, que normaliza únicamente diferencias conocidas de representación
entre entornos; no se usa para vigilar cambios dentro de producción.

## Regla operativa

No se ejecutan `CREATE OR REPLACE FUNCTION`, `CREATE/DROP/ALTER POLICY` ni
cambios equivalentes en producción desde el editor SQL como corrección ad hoc.
Todo cambio debe vivir primero en una migración versionada, pasar por local y
preview, tener respaldo fresco y recibir autorización explícita.

