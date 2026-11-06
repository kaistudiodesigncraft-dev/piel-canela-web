# H-12 — reconciliación preparada para la salida

Estado: **preparada y validada en Supabase local**. No se aplicó en producción.

## Fuente de verdad

La migración se generó desde las definiciones efectivas exportadas por
`pg_get_functiondef` en el respaldo SELECT-only de producción del 03/11/2026:

`backups/sprint-1/production-readonly-2026-11-03_014847/`.

Antes de una aplicación productiva debe compararse contra un respaldo fresco del
mismo día. Si una definición cambió, se detiene la liberación y se regenera la
migración tomando producción como autoridad.

## Objetos reconciliados

1. `delete_professional_if_unlinked(uuid,text)`;
2. `get_professional_usage_counts()`;
3. `get_available_slots_for_zone_order(text,text,date)`;
4. `get_depilation_order_context(uuid,uuid,uuid[])`;
5. `publish_site_content_section(site_content_section)`;
6. `reconcile_professional_identity(uuid,uuid,text,text)`;
7. `resolve_booking_selection_v2(uuid,uuid,uuid,uuid[])`;
8. `save_depilation_combo_v3(...)`.

Las ocho definiciones locales reconciliadas coinciden con producción al
normalizar CRLF/LF. Todas conservan `SECURITY DEFINER`, `search_path = ''`,
volatilidad y resultado. Los 27 grants efectivos coinciden exactamente.

## Archivos

- Migración:
  `supabase/migrations/20261101000100_reconcile_effective_production_functions_h12.sql`.
- Rollback:
  `docs/sprint-1/sql/20261101000100_reconcile_effective_production_functions_h12.rollback.sql`.
- Test ajustado al contrato productivo:
  `supabase/tests/professional_deletion.sql`.

La versión se ubica antes de H2 para que sea la primera migración pendiente al
liberar el circuito universal.

## Ensayo y regresión

- Aplicación local: aprobada.
- Comparación de definiciones contra el respaldo productivo: 8/8 iguales.
- Comparación de grants: 27/27 iguales.
- Rollback: vuelve al esquema H10 sin diferencias semánticas.
- Verificador: ahora normaliza solo finales de línea CRLF/LF en los modos de
  vigilancia; cualquier cambio de SQL, grants, firma o atributo continúa
  bloqueando.
- Regresión `professional_deletion.sql`: aprobada. Fija el comportamiento real:
  toda asignación, incluso archivada, bloquea el borrado; un perfil realmente
  desvinculado sí puede eliminarse.
- Regresión Depilación por zonas: aprobada.
- Regresión combos mixtos públicos: aprobada.
- Aceptación H10 de paquetes: aprobada.
- `supabase db lint --local --level warning`: cero errores.
- TypeScript y ESLint del verificador: aprobados.

Todos los fixtures se ejecutaron en transacciones con rollback. No se tocaron
datos de la clienta.

## Ruta mínima para que la clienta cargue HIFU

El desarrollo ya no necesita lógica nueva para HIFU. La habilitación segura
requiere, en este orden:

1. habilitar las herramientas MCP de Supabase en la sesión activa o vincular el
   CLI, solo para obtener un respaldo fresco de producción;
2. confirmar que la copia cifrada del respaldo existe en una segunda máquina;
3. comparar el esquema fresco con H-12 y exigir cero diferencias no explicadas;
4. aplicar H-12 y luego H2–H10 en preview/base de prueba;
5. desplegar la rama a preview;
6. crear un tratamiento de prueba no publicado, recorrer editor, catálogo,
   cotización, calendario, pre-reserva y panel;
7. aplicar a producción con `config_enabled=false` por defecto;
8. permitir que la clienta cree HIFU y active el circuito solo cuando su
   catálogo esté completo.

Hasta completar los puntos 1–6, afirmar que la clienta ya puede cargar HIFU en
producción sería incorrecto. El bloqueo restante es operativo de liberación, no
de producto.
