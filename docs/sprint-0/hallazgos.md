# Hallazgos abiertos — Sprint 0

No se resolvió ninguno de estos puntos en este sprint. Cada uno conserva el estado actual.

## Bloqueantes para generalizar

### H-01 — El catálogo de zonas es global y específico de Depilación

- **Riesgo:** alto.
- **Evidencia:** `depilation_zones` no tiene `treatment_id`; `src/lib/supabase/public-catalog.ts:445-458` asigna el mismo catálogo a tratamientos no simples cuando está activa la bandera.
- **Impacto:** un segundo tratamiento configurable podría mostrar zonas de Depilación o depender de lógica que no le corresponde.
- **Recomendación:** en otro sprint, crear una asociación aditiva tratamiento↔ítems o un catálogo genérico nuevo, preservando las 21 zonas y los 14 combos actuales sin conversión automática.

### H-02 — Reglas esenciales viven solo en código/entorno

- **Riesgo:** alto.
- **Evidencia:** `DISCOUNT_MIN_ZONES=2` en `src/lib/depilation-order.ts:2`; `DEPILATION_ZONES_ENABLED` en loaders y acciones; propósito firmado `depilation-order-v1` en el módulo servidor.
- **Impacto:** no se puede generalizar por configuración de base sin modificar código y protocolo.
- **Recomendación:** modelar capacidades por tratamiento en forma aditiva. Mantener estos valores como compatibilidad de Depilación hasta retirar la bandera mediante un plan explícito.

### H-03 — RPC y tablas usan contrato nominal de Depilación

- **Riesgo:** alto.
- **Evidencia:** `supabase/migrations/20261020000100_depilation_zone_orders.sql` y tablas `depilation_zones`/funciones asociadas.
- **Impacto:** renombrar o reutilizar directamente rompería contratos existentes.
- **Recomendación:** no renombrar. Crear interfaces/RPC v2 genéricas que deleguen al contrato histórico para Depilación.

## Inconsistencias de producto

### H-04 — Copy legal desactualizado

- **Riesgo:** alto para expectativas del usuario; no afecta integridad de datos.
- **Evidencia:** `src/app/(public)/condiciones-de-reserva/page.tsx:21` afirma que los combos no permiten agregar zonas individuales, mientras el flujo actual admite zonas sueltas/adicionales.
- **Recomendación:** validar el texto con la agencia antes de cambiarlo; hacerlo en un sprint de contenido, no en este diagnóstico.

### H-05 — Transferencia de seña no limitada a Depilación

- **Riesgo:** medio.
- **Evidencia:** `business_settings.cancellation_policy` dice que la seña se puede transferir a otra persona sin limitar el servicio.
- **Recomendación:** confirmar si la restricción exclusiva para Depilación sigue vigente y actualizar desde el panel si corresponde.

### H-06 — Extras históricos activos pero no publicables

- **Riesgo:** medio.
- **Evidencia:** 20 extras, 19 activos; 0 vínculos en `treatment_combo_allowed_extras`; todos los combos tienen `allow_public_extras=false`.
- **Impacto:** técnicamente existen, pero el público no puede seleccionarlos.
- **Recomendación:** conservarlos. Decidir si son archivo histórico o si la agencia desea asociarlos manualmente a combos concretos.

### H-07 — Orden comercial poco explícito

- **Riesgo:** bajo/medio.
- **Evidencia:** los 14 combos tienen `display_order=0`; 18 de 21 zonas también tienen orden 0.
- **Recomendación:** no renumerar automáticamente. Si se desea curaduría, debe hacerse desde panel con aprobación.

### H-08 — Snapshots históricos difieren de precios actuales

- **Riesgo:** bajo; es comportamiento esperado.
- **Evidencia:** las dos reservas de Depilación conservan importes de su momento, distintos de algunos precios vigentes.
- **Recomendación:** nunca recalcular esos snapshots. La diferencia confirma que el contrato histórico funciona.

### H-09 — Nombres/audiencias no normalizados

- **Riesgo:** bajo.
- **Evidencia:** mayúsculas y nombres como `dedos de los pies`; algunas zonas `shared` tienen texto “Hombres”.
- **Recomendación:** no inferir ni corregir automáticamente. La agencia debe decidir cada etiqueta.

## Datos y seguridad

### H-10 — El respaldo es lógico, no un `pg_dump` binario

- **Riesgo:** medio operativo.
- **Evidencia:** acceso disponible mediante consultas de lectura; se exportaron 31 tablas a JSON y se copió el historial de 54 migraciones con checksums.
- **Recomendación:** antes de una migración destructiva futura —hoy prohibida— obtener además un `pg_dump` directo desde un entorno autorizado. El respaldo actual es suficiente para comparar y reconstruir en un entorno aislado, pero la restauración debe ensayarse antes de cualquier uso real.

### H-11 — Diferencia entre historial de migraciones y policies actuales

- **Riesgo:** medio.
- **Evidencia:** la policy efectiva de producción admite `closed_combo` y `combo_with_extras`. El esquema actual es autoritativo; el historial debe conservar todas las sustituciones de policies en orden.
- **Recomendación:** usar la consulta de `pg_policies` como control en cada liberación y no inferir seguridad a partir de una única migración antigua.

### H-12 — Ocho funciones difieren entre producción y la reconstrucción del repositorio

- **Riesgo:** alto antes de la próxima migración productiva.
- **Evidencia:** comparación de `pg_get_functiondef` de producción contra el
  esquema reconstruido localmente. Seis diferencias son de formato/comentarios;
  dos cambian lógica: `get_professional_usage_counts()` y
  `delete_professional_if_unlinked(uuid,text)`.
- **Trazabilidad:** Git identifica autores y fechas de los archivos versionados,
  pero `supabase_migrations` no guarda actor/fecha y casi todas las entradas
  involucradas tienen `statements = null`. No hay evidencia suficiente para
  atribuir quién o cuándo redefinió producción.
- **Impacto:** un `db reset` local no reproducía el comportamiento real aunque el
  historial declaraba las migraciones aplicadas.
- **Mitigación H2:** el ensayo restauró las definiciones reales de producción y
  obtuvo cero diferencias después del rollback.
- **Recomendación:** antes de la primera migración productiva, agregar una
  migración de reconciliación que lleve las definiciones reales de producción al
  repositorio sin cambiar comportamiento. Ver detalle en
  `docs/sprint-1/h2-function-drift-h12.md`.

## Decisiones que requieren confirmación

1. ¿La transferencia de seña debe ser exclusiva de Depilación?
2. ¿Los 20 extras históricos deben seguir archivados o asociarse a combos específicos?
3. ¿El próximo tratamiento configurable debe compartir conceptos con Depilación pero mantener un catálogo de ítems propio? Recomendación: sí, mediante modelo aditivo genérico.
4. ¿El mínimo de dos zonas para descuento seguirá fijo o debe quedar como capacidad configurable por tratamiento? Recomendación: conservar 2 para Depilación y hacer configurable solo el futuro modelo genérico.

## Resumen de riesgo

| Área | Estado | Riesgo |
|---|---|---|
| Agenda mensual, profesional, disponibilidad | reutilizable | bajo |
| Tratamiento simple/combos como modo | reutilizable | bajo |
| Snapshots de reserva | reutilizable y funcionando | bajo |
| Zonas/combos/RPC/flag de Depilación | específicos | alto |
| Copy legal público | contradictorio | alto |
| Extras históricos | preservados pero no expuestos | medio |
| Generalización a otro tratamiento | requiere modelo aditivo | alto si se improvisa; medio con plan |

