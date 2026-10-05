# Auditoría administrativa de Piel Canela

Fecha: 2026-10-03. Base de código: `52c4277`.

## Dictamen

No corresponde certificar el circuito completo como libre de errores. El acceso, catálogo y editor de depilación cargan, pero hay riesgos importantes en identidades y guardado de profesionales, y recuperación insuficiente ante fallos de imagen. No se modificó contenido productivo, no se fusionaron perfiles y no se ejecutó deploy.

## Método y alcance

- Navegación autenticada en producción con la cuenta autorizada: inicio, catálogo, editor del borrador de depilación, zonas/combos/extras y profesionales.
- Capturas reales en escritorio y profesionales a 320 px. No equivale a una certificación de todos los breakpoints o WCAG.
- Revisión de acciones, componentes, autorización y migraciones locales.
- Pruebas SQL sobre Docker local con datos sintéticos y rollback. Nunca reset ni seed productivo.
- No se enviaron WhatsApps, reservas, emails, cambios de contraseña ni publicaciones de prueba en producción.
- El entorno local no contiene la última migración `20261002000100_safe_professional_deletion.sql`; no se certifica por estas pruebas la eliminación desplegada.

## Recorrido observado

| Paso | Estado | Evidencia |
|---|---|---|
| 1. Iniciar sesión | Correcto en la cuenta admin probada | Dashboard accesible |
| 2. Consultar tratamientos | Correcto | 26 tratamientos; catálogo sin error global |
| 3. Abrir depilación para editar | Correcto | El borrador abre sin el anterior 404 |
| 4. Elegir especialidad y profesionales | Riesgo alto | Dos opciones de Agustina y selector de modalidad excesivamente comprimido |
| 5. Guardar tratamiento | Parcialmente validado | RPC local atómica y control de edición obsoleta pasan; no se creó contenido en producción |
| 6. Cargar imagen | Riesgo confirmado por código | Error de carga deja custom validity y no existe descarte explícito |
| 7. Configurar depilación | Navegación correcta; contenido incompleto | Una zona, un extra, cero combos en el borrador revisado |
| 8. Crear/editar profesional | Riesgo alto reproducido | Guardado en tres operaciones independientes |
| 9. Usar desde celular | Parcial | Profesionales usable a 320 px, pero mucha introducción antes del primer campo |
| 10. Recuperar cambios/eliminar | No certificado extremo a extremo | No se hicieron restauraciones ni eliminaciones productivas |

## Hallazgos priorizados

### P1 · Identidades duplicadas debilitan la exclusión por persona

Producción muestra seis perfiles: dos de Agustina Spertino y dos de Melina Albornoz, todos activos. Tienen tratamientos asignados a ambos registros. El motor bloquea por ID, no por nombre; si esos registros corresponden a la misma persona, puede recibir reservas superpuestas entre los dos IDs. La conversación previa identifica estos pares como la misma persona; no se aplicó conciliación durante esta auditoría.

Reparación: inventario y respaldo, conciliación transaccional por correspondencia explícita, detección previa de conflictos, conservación de originales archivados e historial. Nunca fusionar por nombre automáticamente. Verificar dos reservas concurrentes de tratamientos distintos sobre la identidad consolidada.

### P1 · Guardado de profesional no atómico

`src/app/admin/profesionales/actions.ts:80–92`: guarda perfil, elimina relaciones y las vuelve a insertar en peticiones separadas. Además ignora el resultado del delete. Si la última operación falla, la primera no se revierte.

Reproducción local: `tmp/admin-audit-2026-10-03/professional-partial-save.sql`, ejecutado como manager. Se provocó fallo FK en la última inserción; el nombre nuevo permaneció y las relaciones quedaron vacías. Todo el ensayo terminó con rollback. Esto prueba el modo de fallo, no que haya sucedido ya en producción.

Reparación: RPC transaccional de perfil y especialidades, validación de relaciones antes de escribir, versión esperada contra ediciones simultáneas, ID estable para altas e idempotencia. Probar fallo inducido en cada etapa.

### P1 · Imagen opcional puede bloquear publicación tras un fallo

`src/components/admin/TreatmentEditor.tsx:195–277`: la captura del error aplica `input.setCustomValidity(message)`. Publicar usa validación nativa, mientras borrador la omite. No existe acción explícita para descartar el reemplazo fallido. Además la vista previa cambia antes de validar; puede enseñar un archivo que no se guardará. En un tratamiento publicado, el botón alternativo desactiva y guarda.

Reparación: separar imagen persistida de candidata; ofrecer «Descartar intento y conservar imagen actual» o «Continuar sin imagen»; eliminar custom validity al descartar, conservar path anterior y permitir guardar sin despublicar. Pruebas de rechazo local, Storage, procesamiento, timeout y recuperación. Hallazgo de código; no se forzó un upload fallido en producción.

### P1 · Cambios de habilitación profesional sin análisis completo de impacto

La acción solo exige confirmación para desactivar un profesional con asignaciones activas. Retirar una especialidad utilizada no tiene análisis equivalente. Un fallo en la consulta de conteo se interpreta como cero (`actions.ts:65`). Puede dejar tratamientos sin candidatos válidos o permitir una operación sin advertencia.

Reparación: validar tratamientos y futuras reservas afectados dentro de la RPC; fallar de forma segura si no se puede calcular el impacto; mantener reservas históricas y ofrecer sustitución explícita, nunca automática.

### P2 · Formulario de profesionales pierde contexto en errores

`ProfessionalsAdmin.tsx:98–107` usa formulario con redirecciones, sin valores conservados, estado pendiente ni protección de cambios sin guardar. No hay token de versión. Una edición simultánea puede sobreescribir la anterior. No se afirma que un doble clic siempre genere duplicados: depende de las restricciones existentes.

Reparación: respuesta estructurada por campo, valores conservados, useActionState/useFormStatus, bloqueo de doble envío, error con foco y guardia de salida. Mantener borrador local en memoria, no una base de datos en navegador.

### P2 · Consulta secundaria puede derribar Profesionales

`src/app/admin/profesionales/page.tsx:16–23`: el fallo del conteo de uso provoca error de toda la página. Reparación: mantener perfiles y taxonomías visibles; si no se conoce el uso, bloquear acciones destructivas y mostrar advertencia con reintento y correlation ID.

### P2 · Selector de modalidad casi ilegible en escritorio

Captura `04-asignacion-duplicada.jpg` (nombre heredado): muestra en realidad el bloque «Forma de reserva», comprimido por los enlaces contiguos. El texto se parte en varias líneas y el select apenas muestra su valor.

Reparación: ancho mínimo del campo, enlaces en una segunda fila y grid responsive. Verificar 320/390/768/1024/1440 px y zoom 200 %. No modificar reglas de combos.

### P2 · Recuperación y accesibilidad del editor

El error de professionalIds enlaza a un ID sin destino de campo; los errores de imagePath pueden apuntar a un input oculto. Profesionales inactivos seleccionados se representan con checkbox disabled y no entran en FormData, por lo que hay riesgo de retirar asignaciones al guardar. Confirmar este último caso con test de integración antes de cambiar la semántica.

Reparación: destinos de error visibles y enfocables; diferenciar preservación histórica de asignación habilitada para nuevas reservas; no depender de campos disabled para transmitir valores que deban conservarse.

## Depilación actual

El acceso a configuración funciona. El borrador revisado tiene una zona activa de precio cero, un extra y ningún combo. No está listo para publicación ni permite certificar el circuito de venta. No se deben inventar precios o combos para completarlo. Corresponde cargar un caso sintético en entorno aislado y después acompañar la carga comercial real.

## Controles que sí dieron resultado

- 56 archivos / 170 pruebas unitarias aprobadas en esta ejecución.
- Lint y typecheck aprobados.
- Inicio y cierre de sesión comprobados en producción.
- `supabase/tests/rls_boundaries.sql` aprobado local: manager no se autopromueve y no lee auditoría privada; anon sin acceso de escritura a tratamientos ni lectura de auditoría.
- `supabase/tests/booking_integrity.sql` aprobado local: guardado atómico sin imagen, rechazo de versión vieja, asignación habilitada, reprogramación con duración/buffer, restricciones de disponibilidad, rate limit y rechazo de restauración obsoleta.
- La prueba nueva reprodujo el guardado parcial del profesional, con rollback.
- Sin mensajes error/warn capturados por la API de consola en la navegación revisada; esto no cubre logs de servidor ni errores de operaciones que no se ejecutaron.

## Plan de reparación y puertas de salida

1. **Integridad de equipo:** RPC atómica, control de versión e impacto; conciliar identidades con respaldo y validación de conflictos. Salida: una persona no recibe dos reservas simultáneas y cualquier fallo deja perfil/relaciones intactos.
2. **Carga resistente:** recuperación de foto opcional, guardado sin pérdida de datos, pending/idempotencia y errores por campo en profesionales. Salida: alta, edición y publicación funcionan aun después de una foto fallida.
3. **Claridad de depilación:** corregir layout; checklist de publicación y un caso completo de zonas, combo y extras en entorno aislado. Salida: cotización pública/servidor iguales y reserva con snapshots correctos.
4. **Regresión operativa y permisos:** paridad de migraciones local, smoke manager/admin, eliminar/restaurar con datos de prueba, concurrencia real, responsive y teclado; luego preview y aprobación antes de producción.

## Límites y seguridad

No es un pentest completo ni una garantía contra errores futuros. Falta E2E de escritura desde navegador con manager, pruebas reales de concurrencia, recuperación de contraseña/email, eliminación/restauración, procesamiento de fotos y auditoría de configuración productiva. No se ejecutó build ni auditoría de dependencias en esta auditoría. Las credenciales suministradas no se guardaron en este informe. Conviene rotarlas por haber sido compartidas en el chat.

Capturas privadas de evidencia: `tmp/admin-audit-2026-10-03/`. No incluir esa carpeta en un push automático: contiene nombres y contenido administrativo real.
