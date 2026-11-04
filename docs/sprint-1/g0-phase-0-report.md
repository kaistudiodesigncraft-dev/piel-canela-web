# Sprint 1 — G0 y Fase 0

Fecha de corte: 2026-10-29 (America/Buenos_Aires)

## Alcance y protección aplicada

- Todas las lecturas de producción se realizaron mediante `SELECT` desde el SQL Editor autenticado.
- No se ejecutaron migraciones, `INSERT`, `UPDATE`, `DELETE`, cambios de contenido ni despliegues.
- No se copiaron datos personales a este documento. Los archivos que sí contienen filas de producción permanecen bajo `backups/`, ignorados por Git.
- Las altas, ediciones y reservas posteriores al Sprint 0 fueron confirmadas por el responsable del producto como actividad válida. No se eliminó ni alteró ningún cliente, reserva, tratamiento, profesional, medio ni relación.

## G0 — Resultado de compuertas

### G0.1 Restauración local y verificador original

La restauración local se ensayó desde `backups/sprint-0/2026-10-28_013257` siguiendo `docs/sprint-0/backup-and-restore.md`. El verificador original cerró con 31 tablas, 0 diferencias y 0 bloqueantes. El estado original de Docker fue restaurado al terminar.

El SQL de restauración se adaptó únicamente en la copia local ignorada para preservar IDs (`session_replication_role=replica` y `OVERRIDING SYSTEM VALUE`). SHA-256 de la copia usada: `048ba7eb591c389fb4fd78263741efced8abba46d8f08aca3e9a7a4ec26734b2`.

### G0.2 Producción

La comparación inicial contra el corte del 28 de octubre detectó actividad real posterior: dos tratamientos agregados, una actualización de precio, un reemplazo de imagen, nuevas asignaciones, un cliente y una reserva. El usuario confirmó expresamente que esos movimientos son válidos.

Por esa autorización se creó una nueva línea base de producción, sin reescribir la original. La verificación de la línea base v2 contra el mismo snapshot de solo lectura devuelve:

```text
Datos: 31 tablas; esquema: 5 grupos.
Diferencias: 0; bloqueantes: 0
```

La protección importante sigue activa: un registro modificado o eliminado respecto de esta línea base hará fallar el verificador. Las adiciones futuras se informan como aditivas.

### G0.3 Verificador ampliado

Se agregó `scripts/verify-baseline-v2.ts` y `docs/sprint-1/baseline-v2.json`.

El verificador:

- calcula fingerprints por fila para todas las tablas exportadas;
- usa identidades compuestas estables para relaciones como `treatment_professionals`, `professional_specialties`, `treatment_combo_zones` y `treatment_combo_allowed_extras`;
- excluye solamente timestamps automáticos `created_at` y `updated_at` del fingerprint de datos;
- calcula fingerprints por objeto para policies, funciones, constraints, triggers y columnas;
- permite objetos agregados;
- falla ante objetos o filas modificados o eliminados.

Comando de verificación del corte:

```powershell
node --experimental-strip-types scripts/verify-baseline-v2.ts `
  --snapshot backups/sprint-1/production-readonly-2026-10-29 `
  --baseline docs/sprint-1/baseline-v2.json
```

### G0.4 Segunda copia cifrada

El respaldo continúa en una sola máquina y contiene datos personales. La copia cifrada en otra ubicación sigue pendiente por indicación expresa del usuario para otra sesión. No debe subirse a Git, Drive sin cifrar ni compartirse por chat.

## Fase 0 — Diagnóstico técnico

### 1. Contrato actual de Depilación

La función pura está en `src/lib/depilation-order.ts:2,29-58`.

- `DISCOUNT_MIN_ZONES = 2`.
- `subtotalCents` suma precio del combo, si existe, y precios de zonas sueltas/adicionales.
- `looseSubtotalCents` suma exclusivamente las zonas sueltas/adicionales.
- El descuento se activa desde dos zonas sueltas; las zonas incluidas en el combo no cuentan para alcanzar el mínimo.
- El descuento nunca reduce el precio propio del combo.
- El porcentaje se convierte a basis points y el monto se redondea al peso entero, conservando precios en centavos enteros.
- La duración es la suma de la duración del combo y las zonas sueltas/adicionales.
- Se rechazan IDs duplicados y una zona suelta que ya esté incluida en el combo.

Esta conducta coincide con el contrato pedido: descuento solo sobre zonas sueltas desde dos selecciones, nunca sobre el combo.

La cotización actual no se recalcula aritméticamente en Postgres. El servidor obtiene contexto vigente mediante `get_depilation_order_context`, ejecuta la función TypeScript y firma el resultado con propósito `depilation-order-v1` (`src/lib/supabase/depilation-order.ts:17-27`). Postgres valida HMAC, vencimiento y vuelve a leer/contrastar el contexto vigente antes de reservar (`supabase/migrations/20261020000100_depilation_zone_orders.sql:74-93,132-200`). Así se impide usar precios o zonas obsoletos, pero el futuro motor v2 debe recalcular completamente del lado servidor como exige el nuevo contrato.

La RPC de contexto confirma además:

- tratamiento activo y modo no simple;
- bandera `depilation_combos_enabled` activa;
- categoría y especialidad activas;
- combo activo y con precio positivo;
- zonas activas, con precio positivo y sin duplicados;
- rechazo de zonas que ya pertenecen al combo (`20261020000100_depilation_zone_orders.sql:17-69`).

### 2. `selection_mode`

En producción es `text` con el constraint `treatments_selection_mode_check`, no un enum. Los valores vigentes son `simple`, `closed_combo` y `combo_with_extras` (`supabase/migrations/20260923001800_professional_assignment_depilation_mixed.sql:11-16`).

Recomendación confirmada para el diseño posterior:

- `booking_config jsonb null`;
- `config_enabled boolean not null default false`;
- `booking_config.mode` manda únicamente con `config_enabled=true`;
- `selection_mode` queda intacto y sigue gobernando el circuito histórico.

Esto permite desplegar estructura y código sin alterar el comportamiento de ningún tratamiento existente.

### 3. Catálogo genérico: opción A vs B

Se recomienda **A: tablas neutrales nuevas** (`treatment_options`, `treatment_option_combos` y relación propia).

Evidencia:

- Las policies públicas actuales de `treatment_combos` y sus relaciones dependen de `business_settings.depilation_combos_enabled` (`supabase/migrations/20260907001400_depilation_closed_combos.sql:255-273`).
- El loader actual obtiene el catálogo global de `depilation_zones` y lo asigna a todo tratamiento no simple (`src/lib/supabase/public-catalog.ts:445-458`).
- Reutilizar esas tablas obligaría a cambiar RLS y semántica del circuito histórico, algo expresamente prohibido.

Riesgos:

- A: riesgo medio por convivencia temporal de dos catálogos, mitigado por `OptionCatalog` y adaptadores explícitos.
- B: riesgo alto porque toca policies y tablas del circuito activo de Depilación y facilita cruces de catálogos.

### 4. Estado real de paquetes

Producción tiene `customer_packages` y `package_redemptions`, ambas con 0 filas en el corte v2. No hay datos de paquetes que migrar.

El esquema actual (`supabase/migrations/20260907001400_depilation_closed_combos.sql:80-149`) ya conserva snapshots comerciales básicos:

- combo, zonas, sesiones, duración, buffer, precio total, precio por sesión, ahorro y vigencia;
- vínculo de reserva inicial y reservas posteriores por `customer_package_id`;
- FKs `ON DELETE RESTRICT` para cliente, tratamiento, combo y reservas.

Los combos ya tienen `mode`, `session_count`, `validity_days` y `fixed_price_cents` (`20260907001400_depilation_closed_combos.sql:48-65`). En producción se agregaron además `appointment_duration_minutes`, reglas de precio y extras públicos; eso no cambia el diagnóstico de paquetes.

RLS: `customer_packages` y `package_redemptions` son de acceso operativo autenticado mediante `is_admin()`; la función incluye roles `admin` y `manager`. Anónimos no tienen lectura ni escritura directa. El circuito público crea la reserva inicial mediante RPC, no mediante acceso directo a estas tablas.

Flujo actual:

1. Una reserva de combo `package` se marca como `package_initial`.
2. Al confirmarse, `activate_package_from_booking()` crea idempotentemente `customer_packages` gracias a la unicidad de `initial_booking_id`.
3. El panel agenda sesiones posteriores mediante `create_admin_package_booking` con idempotency key y disponibilidad real (`src/app/admin/paquetes/actions.ts:42-61`).
4. El panel decide si una sesión completada/ausente consume o se devuelve mediante `set_package_session_consumption` (`actions.ts:64-79`).
5. La vigencia se extiende con motivo obligatorio (`actions.ts:81-91`).

El panel ya muestra saldo, vencimiento, sesiones vinculadas y decisiones manuales (`src/components/admin/PackagesAdmin.tsx:32-47`).

Brechas frente a la Parte B pedida:

- no existe snapshot de reglas operativas (`validityStartsFrom`, separación mínima, aviso, reprogramaciones, ausencia, liberación tardía, seña propia);
- no existe un estado de pago explícito; solo `bookings.deposit_confirmed_at` y el estado del paquete;
- no hay consentimiento específico de paquete; solo consentimiento operativo de WhatsApp por reserva;
- `package_policy` es texto global editable (`src/components/admin/BusinessSettingsAdmin.tsx:47`), no reglas ejecutables ni texto generado;
- la extensión guarda motivo, pero no hay una auditoría estructurada específica de excepción;
- la RPC actual bloquea filas e impide sobreagendar, pero no implementa la máquina de estados de sesión ni una clave idempotente propia para cada transición de saldo que exige el Release 2.

Conclusión: se pueden reutilizar las tablas vacías y el vínculo con `customers`/`bookings`, pero las nuevas reglas deben agregarse con columnas o tablas nuevas y RPC nuevas, sin modificar las funciones existentes.

### 5. Agenda y profesionales en el editor

Ya están resueltos como columnas existentes y se exponen en el editor:

- validación de duración, buffer, intervalo, frecuencia semanal/mensual, día y ocurrencias mensuales, profesionales y `selection_mode` (`src/app/admin/catalogo/actions.ts:20-44`);
- persistencia de `requires_professional_assignment`, `service_frequency`, `monthly_weekday`, `monthly_occurrence_ordinals`, `selection_mode` y `requested_professional_ids` (`actions.ts:367-404`);
- UI de modalidad, especialidad, profesionales, duración, buffer, frecuencia e intervalos (`src/components/admin/TreatmentEditor.tsx:301-373`).

Por lo tanto, agenda, frecuencia, intervalos y profesionales deben permanecer fuera de `booking_config` y presentarse bajo “Disponibilidad y profesionales”.

## Hallazgos y decisiones

1. **Acoplamiento público global — riesgo alto.** `public-catalog.ts` entrega zonas de Depilación a cualquier tratamiento no simple. El catálogo genérico debe cortar ese acoplamiento solo para tratamientos con `config_enabled=true`, sin modificar el camino histórico.
2. **Texto administrativo específico — riesgo medio.** El editor etiqueta como “Precios de depilación” a cualquier tratamiento no simple (`TreatmentEditor.tsx:280`). En H4 debe mostrarse “Circuito histórico” para Depilación y una terminología genérica configurable para los nuevos tratamientos.
3. **Equivalencia aún no ejecutada — compuerta obligatoria.** Los 14 combos, 210 pares, muestras de 3–6 zonas, adicionales y dos snapshots históricos deben dar equivalencia exacta antes de construir la RPC v2.
4. **Paquetes vacíos — oportunidad de bajo riesgo de datos.** Las tablas existen pero están vacías; se puede evolucionar aditivamente sin convertir ventas existentes.
5. **Copia externa cifrada pendiente — riesgo operativo.** No afecta el diagnóstico, pero debe resolverse antes de una migración productiva.

## Plan de implementación propuesto

### Release 1 — plantilla universal

1. **H2, solo local:** migración aditiva con `booking_config`, `config_enabled` y tablas neutrales; esquema Zod versionado; `booking-engine`; adaptadores `LegacyDepilationCatalog` y `GenericCatalog`.
2. **Equivalencia:** ejecutar toda la matriz legacy contra el motor + adaptador. Si hay una sola diferencia no aprobada, frenar.
3. **H3:** RPC `booking-order-v2`, nuevas policies propias y propósito firmado nuevo. Depilación delega al circuito histórico.
4. **H4:** editor genérico con matriz de compatibilidad y simulador; Depilación queda solo lectura como “circuito histórico”.
5. **H5:** flujo público genérico únicamente con `config_enabled=true`; el resto continúa por su ruta actual.
6. **H6:** crear en local un tratamiento de cada modalidad y probar precio, duración, snapshot, disponibilidad, profesionales y RLS.

### Release 2 — paquetes

1. Diseñar migración aditiva sobre tablas vacías: reglas por opción vendible, `rules_snapshot`, pago manual y estado explícito de cada sesión.
2. Crear una RPC transaccional nueva con bloqueo `FOR UPDATE`, idempotencia por acción y auditoría sin datos personales.
3. Extender panel con compra, saldo reservado/consumido/disponible, sugerencias de resultado, excepciones con motivo y vencimientos.
4. Ejecutar concurrencia, idempotencia, RLS, bordes de vigencia y ciclo completo local.

No se preparará ni aplicará SQL hasta recibir aprobación de este diagnóstico y plan.

