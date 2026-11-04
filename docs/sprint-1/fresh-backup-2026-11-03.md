# Respaldo fresco y ensayo de restauración — 2026-11-03

## Alcance y seguridad

- Proyecto: `dlrdlwjighvcyhirwgfu`.
- Extracción de producción: exclusivamente consultas `SELECT` mediante Supabase MCP en modo read-only.
- Producción no recibió migraciones, escrituras ni cambios de contenido.
- La limpieza, restauración y reaplicación de H2 se realizaron únicamente en el contenedor local aislado `supabase_db_g-p-6a6934b02b088191b6e747e7bf181ed3`.
- Los archivos de respaldo permanecen bajo `backups/`, excluido de Git, porque pueden contener datos personales.

## Ubicación

- Respaldo fresco: `backups/sprint-1/production-readonly-2026-11-03_014847/`
- Reexportación desde la restauración local: `backups/sprint-1/local-restored-2026-11-03_014847/`
- Línea base versionable sin datos personales en claro: `docs/sprint-1/baseline-v4-2026-11-03.json`

## Inventario verificado

- 33 tablas.
- 2.486 filas en origen y 2.486 filas en archivos.
- 9 grupos de esquema y 1.985 objetos exportados.
- 0 diferencias de conteo.
- 0 referencias rotas detectadas.
- Conteos operativos relevantes: 21 tratamientos, 6 profesionales, 17 clientes, 13 reservas y 2.036 eventos de auditoría.
- Contrato histórico de Depilación conservado: 21 zonas, 14 combos y 47 relaciones combo-zona.

## Esquema real capturado

Se exportaron directamente del catálogo de producción:

- columnas;
- constraints mediante `pg_get_constraintdef`;
- definiciones de funciones mediante `pg_get_functiondef`;
- grants de funciones;
- grants de tablas mediante el catálogo PostgreSQL;
- policies RLS;
- triggers mediante `pg_get_triggerdef`;
- índices mediante `pg_get_indexdef`;
- estado RLS y propietario por tabla.

El inventario estándar del MCP no exponía los grants de tablas. Se completó ese grupo con una consulta `SELECT` directa sobre `pg_class`, `pg_namespace` y `aclexplode`, obteniendo 807 grants. No se usó `information_schema.role_table_grants` como autoridad porque filtra según la identidad que consulta.

## Ensayo de restauración

1. Se retiró temporalmente H2 solo del esquema local.
2. Se vaciaron únicamente las tablas del contenedor local mediante un script con guardas de destino.
3. Se restauraron las 2.486 filas con triggers desactivados durante la carga.
4. Se restauraron las 87 definiciones reales de funciones de producción.
5. Se restauraron los 261 grants reales de funciones.
6. Se restauraron los 807 grants reales de tablas.
7. Se reexportaron datos y esquema desde la base local restaurada.
8. `verify-baseline-v2.ts --mode local-restore` informó **0 diferencias bloqueantes y 0 excepciones**.
9. Se reaplicó H2 solo en local y se registró la migración `20261102000100` como aplicada.

Estado H2 tras el ensayo:

- tratamientos con `config_enabled=true`: 0;
- opciones genéricas: 0;
- combos genéricos: 0;
- relaciones genéricas: 0.

Por lo tanto, H2 continúa apagado y no convierte ni altera tratamientos existentes.

## Integridad de los artefactos restaurables

- `restore-data.sql`: `6596b7efad2c032d132d5ab2e09c7718407cb161c6e70469808f70ef7e9ff4bb`
- `clear-local-data.sql`: `8922cdf267c3b14abd12ce848c045a8a0033f4a3f4a4913eda29b69a9d5790ef`
- `restore-functions.sql`: `f9b21ad7c439df18dc65dbfc95b02fe46ca102c1571f5b8c15e87089bb3f8ce6`
- `restore-function-grants.sql`: `fce7b641a9fc3f1213e03c45850c59834c91f5cc82afd4592d9f9f50289e891a`
- `restore-table-grants.sql`: `715e96e02ada493e275294fd067cb52372920ccd21f4422b37f218394e77866d`

Los hashes individuales de datos y esquema están en `manifest.json` y `schema-snapshot-manifest.json` dentro del respaldo.

## Compuerta pendiente antes de producción

El respaldo todavía existe en una sola máquina. Antes de cualquier migración remota se requiere:

1. una segunda copia cifrada en una ubicación elegida por el responsable del proyecto;
2. un respaldo fresco el mismo día del cambio;
3. aprobación explícita para producción;
4. reconciliar en el repositorio las definiciones reales indicadas por H-12, tomando producción como verdad y sin modificar comportamiento.
