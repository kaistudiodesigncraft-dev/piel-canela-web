# H-12 — Deriva de funciones entre producción y el historial del repositorio

Fecha de observación: 2026-11-03 (America/Buenos_Aires).

Producción es la autoridad de comportamiento. La comparación se hizo entre
`pg_get_functiondef` exportado directamente de producción y una reconstrucción
local obtenida al ejecutar las migraciones versionadas del repositorio.

Todas las funciones de esta lista son `SECURITY DEFINER`, usan `search_path = ''`
y conservan sus controles de rol internos. Ninguna es una función de trigger y
ninguna policy RLS las invoca directamente.

| Función | Diferencia | Grants efectivos de producción | Consumidores |
|---|---|---|---|
| `delete_professional_if_unlinked(uuid,text)` | **Lógica.** Producción considera cualquier fila de `treatment_professionals` como uso y no elimina asignaciones inactivas. La migración más reciente del repo cuenta solo asignaciones activas, agrega el vínculo legacy `treatments.professional_id` y elimina enlaces inactivos antes del perfil. | `EXECUTE`: `authenticated`, `postgres`, `service_role`. Sin `anon`. | RPC del panel en `src/app/admin/profesionales/actions.ts:104`. No la usan policies ni triggers. |
| `get_professional_usage_counts()` | **Lógica.** Producción cuenta todas las asignaciones de `treatment_professionals`; el repo filtra `assignment.is_active`. | `EXECUTE`: `authenticated`, `postgres`, `service_role`. Sin `anon`. | RPC de `src/app/admin/profesionales/page.tsx:20`. No la usan policies ni triggers. |
| `get_available_slots_for_zone_order(text,text,date)` | **Cosmética.** Cambian formato y compactación; conserva expiración de pendientes, ventanas, bloqueos y asignación profesional. | `EXECUTE`: `anon`, `authenticated`, `postgres`, `service_role`. | Reserva pública (`reservar/actions.ts`), fechas disponibles y helpers de turnos manuales. No la usan policies ni triggers. |
| `get_depilation_order_context(uuid,uuid,uuid[])` | **Cosmética.** La definición de producción está compactada; conserva validaciones, duración manual del combo, catálogo y versión de cotización. | `EXECUTE`: `anon`, `authenticated`, `postgres`, `service_role`. | RPC de contexto en `src/lib/supabase/depilation-order.ts:20` y verificación privada de cotización. No la usan policies ni triggers. |
| `publish_site_content_section(site_content_section)` | **Cosmética.** Solo difiere espacio en blanco; publicación, snapshot y bloqueo son iguales. | `EXECUTE`: `authenticated`, `postgres`, `service_role`. Sin `anon`. | RPC de `src/app/admin/contenido/actions.ts:206`. No la usan policies ni triggers. |
| `reconcile_professional_identity(uuid,uuid,text,text)` | **Cosmética.** Producción no conserva comentarios explicativos presentes en la migración; locks, comprobaciones y remapeos son iguales. | `EXECUTE`: `authenticated`, `postgres`, `service_role`. Sin `anon`. | RPC administrativa de mantenimiento para propietarios; actualmente no tiene llamada desde la UI. No la usan policies ni triggers. |
| `resolve_booking_selection_v2(uuid,uuid,uuid,uuid[])` | **Cosmética.** Mismo precio, duración manual, extras, sesiones y descuentos; cambia el formato del cuerpo. | `EXECUTE`: `anon`, `authenticated`, `postgres`, `service_role`. | Funciones de disponibilidad, creación pública y alta manual de reservas. No la usan policies ni triggers. |
| `save_depilation_combo_v3(...)` | **Cosmética.** Misma delegación a v2 y misma actualización de duración manual; cambia el formato. | `EXECUTE`: `authenticated`, `postgres`, `service_role`. Sin `anon`. | La invoca `save_depilation_combo_v4`, que es la RPC usada por el editor de combos. No la usan policies ni triggers. |

## Trazabilidad disponible

El historial Git identifica quién incorporó las migraciones del repositorio, no
quién ejecutó o sustituyó después una definición en producción:

- `56efcad`, 2026-09-03, `kaistudiodesigncraft-dev`: publicación de contenido;
- `8822676`, 2026-09-29, `kaistudiodesigncraft-dev`: conciliación profesional;
- `fc661a9`, 2026-10-14, `kaistudiodesigncraft-dev`: conteo y borrado profesional;
- `02ade2a`, 2026-10-21, `kaistudiodesigncraft-dev`: calendario/cotización y duración manual de combos.

`supabase_migrations.schema_migrations` confirma esas versiones como aplicadas,
pero no guarda actor ni fecha. Cuatro entradas tienen `statements = null`; la de
contenido solo registra “Applied and verified from the Supabase SQL editor”. El
catálogo PostgreSQL tampoco conserva `updated_at` de funciones. La sesión MCP no
expone historial del editor SQL ni logs DDL con retención suficiente. Por ello no
es posible atribuir responsable ni momento exacto sin especular.

La explicación compatible con la evidencia es: las definiciones pudieron
aplicarse desde el editor SQL con un cuerpo diferente al archivo actual, o dos
funciones pudieron redefinirse después. No se afirma cuál ocurrió.

## Alcance de H2

La migración `20261102000100_universal_booking_config_h2.sql` no contiene
`create or replace function`, no redefine ninguna de estas ocho funciones y no
modifica sus grants. Solo agrega columnas, tablas, constraints, policies y
triggers propios del catálogo neutral.

## Plan de reconciliación previo a producción — no ejecutado

1. Crear un respaldo SELECT-only fresco y exportar definiciones y ACL desde el
   catálogo real de producción.
2. Generar una migración nueva, sin editar migraciones ya aplicadas, que redefina
   las ocho funciones con el `pg_get_functiondef` exacto de producción y replique
   sus `REVOKE/GRANT` efectivos.
3. Fijar con tests los dos comportamientos lógicos actuales de producción:
   conteo de todas las asignaciones y bloqueo de borrado ante cualquier vínculo.
4. Restaurar producción en local, aplicar la migración de reconciliación y exigir
   cero diferencias de funciones, grants, policies, constraints y triggers.
5. Ejecutar regresión de profesionales, contenido, Depilación y reservas.
6. Solicitar aprobación explícita antes de producción. Allí la migración debe ser
   un no-op conductual: su objetivo es alinear el repositorio con producción.
7. Actualizar la línea base autorizada únicamente después de la aplicación
   verificada.

No se reconciliarán las dos diferencias lógicas eligiendo la versión “más nueva”:
producción manda y cualquier mejora funcional posterior será otra migración y otra
decisión de producto.

