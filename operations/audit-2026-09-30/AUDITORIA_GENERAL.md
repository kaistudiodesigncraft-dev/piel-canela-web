# Auditoría general previa al despliegue

Fecha: 30 de septiembre de 2026. Proyecto: Piel Canela / Kai Studio.

## Dictamen

**No recomiendo desplegar el estado actual como versión plenamente validada.** Compilación, tipos, lint y pruebas unitarias pasan, pero hay inconsistencias de integridad entre flujos de reservas, profesionales y guardado de tratamientos. También falla el control de dependencias de producción.

Esto no implica que toda la plataforma esté rota ni demuestra pérdida de datos. Sí impide garantizar que todos los recorridos resuelvan las mismas reglas del negocio.

Auditoría del árbol de trabajo local sobre `6b07654`, incluyendo cambios sin commit existentes al comenzar. No es una certificación de la configuración efectiva de Supabase o Vercel. No se modificaron datos del cliente, código funcional, migraciones ni producción; no se hicieron commit, push o deploy. Se agregaron este informe y un inventario de imports de solo lectura.

## Qué es realmente el producto

Piel Canela es una plataforma para un centro de estética, bienestar y recuperación: sitio institucional, catálogo administrable, pre-reservas y operación de recepción.

Resuelve cuatro necesidades:

1. Presentar tratamientos, precios y duración sin depender de consultas repetitivas.
2. Solicitar un turno online, con disponibilidad calculada en servidor y asignación de profesional.
3. Gestionar desde recepción profesionales, horarios, reservas, depilación con combos/extras y paquetes de sesiones.
4. Editar contenido e imágenes del sitio dentro de una estructura controlada, con historial y recuperación.

La arquitectura es Next.js/React con TypeScript, Supabase para PostgreSQL/Auth/Storage y despliegue previsto en Vercel. La base conserva datos operativos; cambiar componentes no debe borrarlos. Sin embargo, la preservación también depende de migraciones compatibles, backups y pruebas: no se puede prometer solo porque los datos estén en Supabase.

**No es** una tienda con cobro online, un sistema de conciliación bancaria, facturación, historia clínica, ERP ni plataforma multisucursal. La seña se verifica humanamente. El enlace WhatsApp prepara un mensaje que la persona debe enviar.

Existe código para una integración de WhatsApp Cloud API con cola, worker y webhook, pero su existencia no acredita que esté activada ni configurada en producción. Las plantillas, credenciales, consentimientos y ejecución periódica requieren validación propia. Tampoco se verificó en esta sesión la entrega real de correos de recuperación.

## Evidencia y validaciones

| Control ejecutado | Resultado | Alcance real |
|---|---|---|
| TypeScript `tsc --noEmit` | Aprobado | Tipos del árbol local |
| ESLint | Aprobado | Código local |
| Vitest | 52 archivos, 161 pruebas aprobadas | No sustituye pruebas SQL/RLS/concurrencia |
| Next build | Aprobado | Configuración local con fixtures; no prueba la conexión productiva |
| Auditoría de dependencias de producción | Falló: un aviso crítico en Next.js | Explotabilidad condicionada a una API no encontrada en el proyecto |
| Inventario de imports | 212 archivos TS/TSX, 53 entradas de rutas | Siete candidatos sin alcance desde rutas actuales |
| Migraciones inspeccionadas | 35 archivos locales | No se compararon contra el historial remoto |
| Recorrido visual actual | No completado | Navegador bloqueado por política de acceso; no se intentó eludirla |
| Smoke admin, RLS y E2E reales | No ejecutados en esta sesión | Pendientes en entorno aislado/preview autorizado |

No se atribuyen resultados actuales a capturas de sesiones anteriores. No se certifica WCAG, responsive, ausencia de errores de consola ni Core Web Vitals sin recorridos y mediciones actuales.

## Hallazgos prioritarios

### P1 · Validación antigua incompatible con profesionales multiespecialidad

**Evidencia:** `supabase/migrations/20260821000600_sprint_two_catalog_integrity.sql:9–44`; `src/app/admin/catalogo/actions.ts:311`.

El trigger `validate_treatment_professional_specialty` compara únicamente `professionals.specialty_id` con la especialidad del tratamiento. La aplicación ya admite múltiples especialidades, pero sigue escribiendo el primer profesional seleccionado en el campo legado `professional_id`. No hay sustitución posterior de ese trigger en las migraciones locales.

**Consecuencia:** una profesional habilitada por la relación multiespecialidad puede ser rechazada al guardar si su especialidad original es otra. Es un mecanismo verificable de fallo, no una atribución confirmada de los incidentes anteriores sin consultar sus logs.

**Corrección:** unificar elegibilidad alrededor de relaciones vigentes y conservar compatibilidad del campo legado. Prueba obligatoria: guardar y publicar con una profesional cuya especialidad original difiere, pero tiene habilitada la del tratamiento.

### P1 · Autoasignación más amplia que la selección explícita

**Evidencia:** `supabase/migrations/20260929000100_professional_availability_windows.sql:4–38`.

Los candidatos son la unión de profesionales vinculados al tratamiento, el campo legado y todos los de su especialidad. La última rama no está limitada a tratamientos sin asignaciones explícitas.

**Consecuencia:** quitar una asignación al tratamiento no excluye necesariamente a esa persona del algoritmo. Puede asignarse un profesional habilitado para una especialidad, pero no para ese procedimiento concreto.

**Corrección:** definir una única fuente de elegibilidad. Si se conserva un fallback legado, usarlo únicamente bajo una condición explícita y comprobada. Probar también vínculos desactivados.

### P1 · Reprogramación no valida las mismas reglas que el alta

**Evidencia:** `supabase/migrations/20260821000700_sprint_three_customer_operations.sql:51`; `src/components/admin/LiveAdminDashboard.tsx`.

La RPC comprueba rol, fecha mínima y estado, y actualiza el rango según el snapshot. La exclusión impide solapamientos, pero la función no valida ventanas semanales, bloqueos o disponibilidad profesional. El selector del panel consulta disponibilidad por tratamiento/combo sin pasar la reserva actual ni sus extras/snapshots.

**Consecuencia:** el servidor puede aceptar una reprogramación fuera de atención. La pantalla puede ofrecer un rango calculado con una duración diferente o considerar ocupado el propio turno que se está moviendo.

**Corrección:** operación específica basada en reserva, con exclusión de sí misma, duración contratada y validación transaccional final. No depender del calendario del navegador.

### P1 · Paquetes conservan disponibilidad por especialidad

**Evidencia:** `supabase/migrations/20260907001400_depilation_closed_combos.sql:997` y versiones posteriores de creación de sesión.

`get_available_slots_for_package` bloquea ante cualquier reserva de la misma especialidad, pero no comprueba la disponibilidad del profesional como lo hace el motor nuevo. La creación posterior sí intenta asignarlo.

**Consecuencia:** puede ocultar un horario válido con otro profesional o presentar un horario que falla al guardar porque el profesional trabaja en otra especialidad.

**Corrección:** compartir reglas entre consulta y confirmación de sesión, respetando snapshots y vigencia del paquete. Probar dos profesionales simultáneos y uno ocupado en otro tratamiento.

### P1 · Guardado de tratamientos susceptible a resultados parciales

**Evidencia:** `src/app/admin/catalogo/actions.ts:335–351`; `src/lib/admin/treatment-editor-data.ts:31–59`.

El guardado realiza solicitudes separadas para tratamiento, asignaciones y publicación. Un fallo intermedio no revierte lo anterior. Además, al cargar edición se ignora el error de consulta de `treatment_professionals`: se interpreta como lista vacía y se recupera solo el campo legado cuando existe.

**Consecuencia:** el panel puede informar fallo aunque haya persistido una parte. Una consulta fallida puede convertir asignaciones múltiples en una selección incompleta y sobrescribirlas al guardar.

**Corrección:** fallar de forma explícita ante relaciones esenciales no disponibles y guardar tratamiento, relaciones y activación en una RPC transaccional. Probar fallos inducidos sin pérdida de datos ni cambios parciales.

### P1 · Restauración histórica sin protección contra cambios posteriores

**Evidencia:** `supabase/migrations/20260925000200_admin_history_restore.sql:80–141`; `src/app/admin/historial/actions.ts`.

La restauración toma `old_data` y actualiza campos sin comparar la versión actual con la que se pretende revertir. El bloqueo del evento de auditoría no protege contra sobrescribir ediciones posteriores de la entidad.

**Consecuencia:** recuperar un cambio antiguo puede deshacer trabajo reciente de otra persona.

**Corrección:** comprobar versión esperada y bloquear la entidad durante la restauración. Ante conflicto, mostrar comparación y exigir resolución explícita. Mantener reservas e imágenes referenciadas intactas.

### P1 · Dependencia con aviso crítico y control de liberación pendiente

`next` y `eslint-config-next` están en `16.3.3`. La auditoría de producción detectó [GHSA-vcvr-r3jv-pc5j](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), corregido en `16.3.6`.

El aviso afecta a `next/og` / `ImageResponse` en Node bajo condiciones específicas de entrada no confiable. **No encontré uso de esas APIs en el código revisado; no hay evidencia de RCE explotable aquí.** Aun así, el control de dependencias falla y debe actualizarse antes de liberar, alineando configuración/lockfile y repitiendo pruebas.

## Seguridad: controles presentes y límites

Controles favorables encontrados:

- Autenticación administrativa con validación de sesión y perfil activo; separación de funciones operativas y gobierno de cuentas.
- Validación de entrada y autorización en servidor, además de varias RPC con controles de rol y `search_path` restringido.
- Exclusión de rangos por profesional para estados que ocupan agenda.
- Medios con intención autenticada, comprobación de propietario, rutas UUID y conservación del archivo previo.
- Eliminación protegida y comprobaciones de vínculos; auditoría de operaciones.
- Headers de seguridad; no se encontró uso de `dangerouslySetInnerHTML`, `eval` o `new Function` en la búsqueda revisada.
- Webhook WhatsApp con comprobación de firma y automatización bajo bandera.
- Consentimiento para analítica y respuestas de recuperación que no revelan si existe una cuenta.
- No se encontraron archivos `.env` reales versionados en la lista actual de Git; esto no equivale a escanear todo el historial.

Pendientes concretos:

1. **Medios:** el navegador normaliza la imagen; el servidor valida firma y dimensiones extraídas de cabeceras y vuelve a guardar los bytes descargados. No los decodifica y reencodea de forma independiente (`src/app/admin/catalogo/media-actions.ts:124`; `src/lib/admin/image-upload.ts:119`). Un archivo corrupto con cabecera aceptable no queda descartado por esa validación. Implementar decodificación completa, límites y normalización en servidor.
2. **Código secundario de eliminación:** hay hash y guard adicional de servidor, pero no encontré un límite específico de intentos/cooldown. Es una protección autenticada adicional, no una barrera adecuada contra intentos repetidos si el código es corto.
3. **CSP:** `script-src` permite `unsafe-inline`. Evaluar nonce por respuesta y compatibilidad con Next antes de endurecer; no se observó una explotación XSS.
4. **RLS/grants efectivos:** faltan pruebas con `anon`, `manager` y `admin` en una base aislada equivalente. Leer migraciones no demuestra qué permisos tiene hoy producción.
5. **Recuperación:** comprobar correo real, caducidad, redirecciones permitidas, cambio de contraseña e invalidación de sesiones. Evaluar MFA para cuentas privilegiadas.
6. **Operación:** verificar restauración de backup, retención y anonimización; rotar credenciales previamente compartidas cuando se coordine, sin incluirlas en documentos o repositorios.

No se ofrece garantía de «seguridad completa». El resultado es una revisión técnica con hallazgos y alcance delimitado, no un pentest exhaustivo.

## Semántica y coherencia operativa

- `CatalogAdmin.tsx:71` anuncia `/tratamientos?categoria=...`, mientras el catálogo usa `category`. Corregir el ejemplo/enlace.
- `getTreatmentPublicationState` exige precio del tratamiento padre aun cuando una propuesta configurable obtiene precio del combo. El indicador de requisitos debe usar el mismo contrato de publicación que el servidor.
- Guardar como borrador sobre un tratamiento publicado cambia su activación: no es un borrador editorial separado. La interfaz debe expresar claramente si retira la publicación.
- README todavía describe capacidad solo por especialidad. El modelo actual por profesional y sus excepciones deben quedar explicados en un único documento vigente.
- PRODUCT y algunas referencias de permisos no reflejan el historial operativo y edición de contenido actuales. La documentación histórica no debe presentarse como contrato vigente.
- La reserva manual todavía no transporta extras de forma equivalente al recorrido público. Completar o declarar esa limitación; no anunciar paridad completa.
- Revisar el significado de `requires_professional_assignment`: el algoritmo de creación autoasigna sin usarlo como bifurcación. No mantener un control que prometa un comportamiento inexistente.

## Carpetas y código sin alcance actual

No se borró nada. «No usado por las rutas actuales» no significa automáticamente «seguro de eliminar».

| Grupo | Directorios | Tratamiento propuesto |
|---|---|---|
| Aplicación y contrato | `src`, `public`, `supabase`, `scripts`, `.github` | Conservar; pruebas y migraciones son parte del producto |
| Referencias/handoff | `sources`, `design`, `docs`, `codex-handoff`, `presentation` | `sources` intocable; clasificar lo demás como vigente o histórico |
| Generados/cachés | `.next`, `out`, `node_modules`, `.pnpm-store`, `playwright-report`, `test-results` | No son pantallas huérfanas; excluir de entrega/versionado según corresponda |
| Herramientas/contexto | `.claude`, `.impeccable`, `.vercel`, `.git` | No limpiar indiscriminadamente; pueden contener configuración necesaria o sensible |
| Evidencias | `operations` | Ordenar por fecha/objetivo; separar informe de capturas y resultados |

El inventario `inventory.mjs` encontró siete candidatos sin camino desde las entradas Next actuales:

- `src/components/admin/AdminPageClient.tsx`
- `src/components/admin/DemoAdminDashboard.tsx`
- `src/components/booking/BookingPageClient.tsx`
- `src/components/booking/DemoBookingFlow.tsx`
- `src/data/demo-bookings.ts`
- `src/lib/demo-bookings.ts`
- `src/lib/admin/agency-unlock.ts`

Los módulos demo tienen usos en pruebas. Antes de retirarlos, decidir si se conserva una demo separada; después actualizar pruebas y documentación. No eliminar fixtures mientras CI siga utilizándolos. No limpiar Storage por analogía con archivos locales.

## Rendimiento, escalabilidad y mantenibilidad

No medí LCP, INP, CLS ni tiempos de consultas productivas. No hay base para afirmar que hoy sea lenta o que soporte una cantidad determinada de usuarios.

Riesgos concretos:

- `getPublicCatalogSnapshot` reúne siete consultas y una falla puede derribar todo el catálogo. El fallback de esquema elimina extras/asignaciones de la respuesta, ocultando diferencias entre código y migración. Separar degradación segura de incompatibilidades críticas; no publicar precios simplificados silenciosamente.
- Se cargan colecciones completas en varios módulos administrativos. Los límites de filas de Supabase pueden truncar listados/conteos al crecer. Introducir paginación y agregaciones SQL, no contar descargando todas las reservas.
- `React.cache` deduplica trabajo en su ámbito; no debe confundirse con una estrategia global de caché e invalidación. Definir caché pública y mantener disponibilidad sensible fuera de cachés obsoletas.
- Hay una imagen conceptual original de aproximadamente 2 MB. `next/image` ayuda, pero conviene comprobar tamaños servidos y prioridad; no concluir sobre transferencia solo por el tamaño del original.
- `globals.css` tiene 6.900 líneas más overrides en `ux-refinements.css`. Hay componentes de 400–550 líneas y JSX muy concentrado en pocas líneas. Esto eleva el riesgo de regresiones y dificulta revisión, no prueba por sí solo un problema de rendimiento.
- Las consultas usan varios casts manuales. Generar contratos desde el esquema y comprobar firmas RPC reduce divergencias silenciosas.

No recomiendo microservicios ni una reescritura. El stack actual es suficiente como base para este negocio. Conviene consolidar reglas compartidas y dividir módulos de forma incremental.

## Propuesta de ejecución priorizada

### Sprint A · Integridad antes del deploy

- Actualizar Next y su configuración compatible.
- Corregir validación multiespecialidad y elegibilidad explícita.
- Unificar reprogramación y sesiones de paquete con el motor de disponibilidad.
- Guardado transaccional del tratamiento; bloquear edición cuando faltan relaciones esenciales.
- Restauración con control de versión.

**Salida:** pruebas SQL de concurrencia/roles, guardado completo o sin cambios, y reserva/reprogramación/paquete coherentes con las mismas reglas. Sin resets productivos ni transformación automática del contenido.

### Sprint B · Operación y seguridad verificables

- Decodificación de imágenes en servidor y límite de intentos del control protegido.
- Completar extras manuales e idempotencia estable entre reintentos.
- Smoke real en entorno aislado: manager carga sin imagen, agrega/reemplaza, publica, edita, reserva, reprograma, usa paquetes y recupera contraseña.
- Validar publicación de contenido, restauración y permisos negativos.
- Backup con restauración probada e inventario antes/después para producción.

**Salida:** evidencia reproducible, sin usar registros reales del cliente como datos de prueba.

### Sprint C · Claridad y mantenimiento

- Corregir textos/URLs/requisitos de publicación y documentación vigente.
- Revisar 320, 390, 768, 1024 y 1440 px, teclado, foco, zoom 200 %, lector de pantalla y movimiento reducido.
- Resolver duplicación CSS, extraer secciones de componentes y archivar demo solo después de validar sus dependencias.
- Paginación, medición de consultas y presupuesto de rendimiento público.

**Salida:** mejora visible sin alterar precios, turnos, identidad o datos cargados.

## Puerta de liberación

1. Cerrar los hallazgos P1 con pruebas de regresión.
2. Comparar las 35 migraciones locales con la base destino; no ejecutarlas a ciegas.
3. Backup y manifiesto de IDs/estados/relaciones/medios antes de migraciones aditivas.
4. Preview desde un commit identificable con configuración Supabase equivalente y datos aislados.
5. Lint, tipos, unitarias, build, auditoría de dependencias, pruebas SQL/RLS/concurrencia y E2E autenticado aprobados.
6. Validación visual actual y smoke productivo no destructivo.
7. Deploy de migraciones compatibles antes del código; comparar inventario y disponer de rollback.

Hasta completar esos controles, la recomendación es preservar la versión productiva actual y trabajar las correcciones en preview.
