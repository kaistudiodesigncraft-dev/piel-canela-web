# Refinamiento UX de Piel Canela

Fecha: 30 de septiembre de 2026.

## Alcance y preservación

Primera iteración de simplificación visual: catálogo, detalle, turnero y superficies administrativas. Se mantienen paleta, familias tipográficas, contenido, rutas y contratos funcionales. La identidad de marca definitiva corresponde a una segunda iteración.

No se ejecutaron migraciones, escrituras en Supabase, cambios de contenido, reservas, eliminaciones ni operaciones sobre Storage. No se realizó commit, push ni despliegue.

El árbol de trabajo ya contenía cambios operativos de sesiones anteriores (reservas manuales, paquetes, errores de depilación y acciones administrativas). Se preservaron. No deben confundirse con este refinamiento visual ni desplegarse sin revisar también su alcance.

Las skills de frontend y auditoría guiaron la reducción de jerarquías desproporcionadas, la priorización de tareas y la verificación mediante capturas, sin introducir una nueva identidad visual.

## Recorrido revisado

| Paso | Cambio y resultado | Evidencia / límite |
| --- | --- | --- |
| Catálogo | Cabecera reducida, buscador y filtros agrupados, fichas más compactas, precio y duración comparables y acción explícita «Ver detalle». | Capturas 01/04/09. Inspección local con fixtures, no inventario productivo. |
| Detalle | Nombre, duración, precio y CTA único antes del contenido extenso; imagen acotada. Se conservan preparación, contraindicaciones y demás información. | Capturas 02/05/06/07. Apertura, cierre con Escape, filtro en URL y retorno de foco comprobados. |
| Turnero | Jerarquía más breve, indicador de paso y controles visualmente más sobrios. | Capturas 03/08. Selección de tratamiento transferida. La disponibilidad devuelve error en este entorno de fixtures: no se certifica una reserva real. |
| Administración | Encabezados compactos, menú móvil con ruta actual, superficies más discretas, categorías como ajuste secundario y explicación simple para imágenes. | Verificación por código y pruebas. No se pudo autenticar con el acceso disponible; revisión visual autenticada pendiente. |

La simplificación de fichas retira características de la vista de comparación, no de los datos: siguen disponibles en el detalle. Tratamientos sin imagen mantienen su acción y no reservan un gran panel visual vacío.

## Archivos de la iteración

- `src/app/ux-refinements.css`: capa de presentación responsive, sin reglas de negocio.
- `src/components/treatments/{CatalogExperience,TreatmentEditorialCard,TreatmentDetailContent}.tsx`: jerarquía y agrupación.
- `src/components/booking/LiveBookingFlow.tsx`: indicador visual de paso, sin cambios de disponibilidad o envío.
- `src/components/admin/{AdminRouteNav,CatalogAdmin,TreatmentEditor}.tsx` y `AdminShell.module.css`: presentación operativa.
- Cabeceras de catálogo, alta y profesionales bajo `src/app/admin/`.
- `next.config.ts`: se desactiva la generación automática de instrucciones por Next (`agentRules`), que intentaba sobrescribir el archivo administrado por el workspace e impedía iniciar el servidor local. No se relajan permisos ni controles de la aplicación.

## Verificación

- Catálogo sin desbordamiento horizontal a 320, 390, 768, 1024 y 1440 px, medido en el navegador.
- Detalle inspeccionado a 320 y 390 px y en escritorio; CTA visible antes de la descripción extensa.
- Turnero inspeccionado a 320 px, sin desbordamiento horizontal.
- Escape cierra el detalle, conserva `category=bienestar` y devuelve el foco al enlace que lo abrió.
- Suite completa final: 52 archivos, 161 pruebas aprobadas (`vitest run --pool=threads --maxWorkers=1`).
- Typecheck y lint aprobados, incluidos los nuevos tests de presentación.
- Build de Next aprobado. Compilación local con configuración de fixtures: no equivale a certificación del despliegue productivo.
- Se agregan tres tests del detalle: prioridad del CTA sin pérdida de contenido, imagen opcional y ausencia de reserva pública en preview administrativo. Se refuerza el test de ficha para exigir jerarquía h3 y una única acción con texto visible.

## Pendientes antes de liberar

1. Validar visualmente el panel con una sesión administrativa real y conexión configurada. No se desactivó autenticación para hacerlo.
2. Verificar reserva y edición reales en un entorno controlado; esta pasada no creó datos de prueba en producción.
3. Revisar el conjunto de cambios operativos preexistentes antes de preparar un commit de liberación.
4. Revisar cifras tipográficas en la siguiente pasada: el ajuste de `zero` ya existe, pero algunos ceros se perciben barrados en capturas. No se declara resuelto.
5. Aplicar la identidad que entregue la agencia en el segundo sprint, manteniendo esta jerarquía orientada a tareas.

No se certifica WCAG completa, concurrencia, seguridad integral ni funcionamiento productivo mediante esta revisión visual.

## Capturas

- `01-catalogo-antes.png`
- `02-detalle-antes.png`
- `03-turnero-antes.png`
- `04-catalogo-despues.png`
- `05-detalle-despues.png`
- `06-detalle-mobile.png`
- `07-detalle-320.png`
- `08-turnero-320.png`
- `09-catalogo-mobile.png`

Las imágenes y textos mostrados en estas capturas son fixtures. La versión local queda disponible en `http://127.0.0.1:3200/tratamientos` para revisión visual.
