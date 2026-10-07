# Depilación: lectura pública y continuidad de reserva

## Causa comprobada

En producción, `treatments.selection_mode` de Depilación es `combo_with_extras`.
La política `treatment_combos_public_read` todavía exigía `closed_combo`.
La consulta anónima devolvía cero combos; la administración sí podía verlos.
La RPC de cotización resolvía correctamente el Combo 1, pero el turnero web no
podía encontrarlo en el catálogo público y devolvía al usuario al selector vacío.

La ficha por slug también conservaba una respuesta estática anterior. Las acciones
de zonas/combos/extras invalidaban el listado, pero no la ficha por slug.

## Reparación

- Migración `20261007000100_public_mixed_combo_visibility.sql`: amplía exclusivamente
  la condición de modalidad de la política existente. Conserva rol anónimo,
  tratamiento publicado, combo publicado y bandera global habilitada.
- Aplicada en el SQL Editor del proyecto `dlrdlwjighvcyhirwgfu` el 7 de octubre.
  Es repetible: usa `ALTER POLICY`, sin crear tablas, triggers ni contenido.
- Catálogo real consultado por petición (`connection` antes de Supabase y fetch
  `no-store`), evitando que Supabase capture la señal de render dinámico como error.
- Mutaciones de combos también invalidan `/tratamientos/[slug]`.
- Preview carga extras vinculados, conserva el estado borrador y solo habilita el
  acceso público al calendario si la consulta anónima confirma visibilidad.
- Un combo inexistente/oculto ya no devuelve a un selector vacío en bucle.
- Admin explica que los extras deben habilitarse y vincularse a cada combo.

## Preservación comprobada

Inventario previo: 2026-10-07 23:26 UTC. Repetido después del cambio de política:
conteos y MD5 de filas completas ordenadas por ID idénticos en las siete tablas.
Estas huellas no sustituyen un backup; verifican que esta operación de permisos
no cambió filas del catálogo. No se ejecutó DML, seed, reset, borrado ni reservas.

| Tabla | Filas | Huella idéntica antes/después |
|---|---:|---|
| treatments | 26 | cce4deae65c2b9b7b2650bd174dc8f60 |
| professionals | 6 | 03a40131e924c18cd4f2217fa185495f |
| treatment_combos | 4 | 72697609b893a629c3b7edf9f32df98e |
| depilation_zones | 11 | 964b01445382b52bded1874bc95d8428 |
| treatment_combo_extras | 11 | 1af729913cd748fadc0833a8cdd8ff98 |
| treatment_combo_zones | 14 | 7551b8f9a98821ded1ef1254cd8ff91a |
| treatment_combo_allowed_extras | 0 | sin filas |

## Configuración comercial pendiente

Hay once extras creados y ninguna vinculación a combos. El Combo 1 tiene
`allow_public_extras=false`. No se modificó esa decisión comercial automáticamente.
Recepción debe editar cada propuesta, habilitar extras, seleccionar los compatibles
y publicar. Crear un extra por sí solo no lo agrega a todos los combos.

## Evidencia y pruebas

- Consulta anónima tras la reparación devuelve los cuatro combos y sus zonas.
- El enlace real de Combo 1 abre calendario con cuatro zonas, 60 minutos y $59.000.
- La búsqueda de próxima fecha encontró horarios el 8 de octubre: 17:00, 17:30,
  18:00 y 18:30. No se generó una pre-reserva productiva.
- Suite global final: 59 archivos, 179 pruebas aprobadas; lint sin errores.
- Build con `NEXT_PUBLIC_DATA_SOURCE=supabase` aprobado; rutas públicas de catálogo
  y ficha confirmadas como dinámicas. Se usó un worker local por límite de memoria.
- Regresiones adicionales: ruta combo/extras a calendario, tratamiento simple,
  rechazo de bucle vacío, preview de borrador, lectura pública y fetch sin caché.
- `supabase/tests/public_mixed_combos.sql` preparado para base aislada con rollback.
  No ejecutado: Docker Desktop no expone el motor Linux en esta sesión.

## Rollback

El cambio SQL es compatible con el código anterior. Revertir el código no exige
revertir datos ni políticas. Volver a la política antigua ocultaría nuevamente los
combos mixtos y no es una recuperación recomendada. No restaurar tablas completas.
