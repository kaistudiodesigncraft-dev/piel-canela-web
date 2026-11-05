# H8 — Motor transaccional de paquetes universales

Estado: completado y validado en Supabase local. No aplicado a producción. No
se modificaron datos de la clienta ni objetos legacy de Depilación.

## Alcance entregado

- Reglas v1 de paquete tipadas y validadas con Zod.
- Defaults por tratamiento en `booking_config.packageDefaults`.
- Ningún plazo, cantidad de sesiones o política se inventa en código: al crear
  la modalidad, H9 deberá suministrar reglas editables desde configuración.
- Reglas propias congelables por propuesta en
  `treatment_option_combos.package_rules`.
- Contratos, sesiones y operaciones idempotentes en tablas neutrales nuevas.
- Vínculo aditivo y nullable desde `bookings.service_package_id`.
- Estado de pago manual y vigencia desde compra o primera sesión.
- Saldo derivado: total menos reservadas, completadas y perdidas; liberadas no
  consumen.
- Cinco RPC transaccionales para compra, sugerencia, disponibilidad, gestión de
  sesión y extensión de vigencia.
- Propietario de mínimo privilegio para las RPC y RLS sin acceso anónimo.
- Los helpers privados son `SECURITY INVOKER`; solo las cinco RPC de frontera
  usan `SECURITY DEFINER` con propietario restringido.

H8 no incluye el panel de operación. La modalidad `package` continúa bloqueada
en la activación pública hasta H9.

## Archivos principales

- Migración: `supabase/migrations/20261104000100_universal_service_packages_h8.sql`
- Dueño de mínimo privilegio: `supabase/migrations/20261104000200_universal_service_packages_h8_owner.sql`
- Rollbacks: `docs/sprint-1/sql/20261104000100_universal_service_packages_h8.rollback.sql`
  y `20261104000200_universal_service_packages_h8_owner.rollback.sql`
- Motor puro: `src/lib/service-package.ts`
- Reglas: `src/lib/booking-config.ts`
- Suite SQL: `supabase/tests/universal_service_packages_h8.sql`
- Concurrencia real: `supabase/tests/h8_concurrency_*.sql`
- Matriz RLS: `docs/sprint-1/rls-matrix-h8.md`

## Integridad y seguridad

Todas las mutaciones que cambian saldo usan una RPC con bloqueo de contrato
`FOR UPDATE` e idempotencia por UUID. El servidor vuelve a leer reglas,
disponibilidad y profesional; no acepta saldo editable del cliente. Una
excepción al resultado sugerido exige motivo y queda auditada sin copiar datos
personales al evento.

Las tablas legacy `customer_packages`, `package_redemptions`, las RPC históricas
y el circuito de Depilación no se redefinieron. El verificador contractual,
comparando el esquema final contra la línea base local autorizada anterior a H8
(`local-h5-security-final-2026-11-03`), informó:

```text
Deriva bloqueante: 0
Actividad/adiciones informativas: 89
Objetos existentes modificados o eliminados: 0
```

Desglose de las 89 adiciones: 49 constraints/objetos de integridad, 20 grants
de función, 8 funciones, 8 policies y 4 triggers.

La comparación acumulada contra el respaldo de producción del 03/11 también
dio deriva bloqueante 0 y 186 adiciones informativas conocidas de H2 a H8.

## Pruebas ejecutadas

### SQL transaccional

La suite local finalizó con código 0 y cubre:

- alta e idempotencia de compra;
- snapshot inmutable ante cambios de configuración;
- sesión inicial vinculada;
- reserva, replay idempotente y cierre;
- saldo correcto y nunca negativo;
- liberación y resultado sugerido;
- excepción sin motivo rechazada y excepción motivada auditada;
- máximo de reprogramaciones;
- paquete vencido bloqueado;
- extensión motivada e idempotente;
- RLS y grants para `anon`, autenticado no operativo y operador.

### Concurrencia

Dos conexiones intentaron consumir simultáneamente la última sesión disponible:

```text
éxitos=1
errores package_has_no_sessions=1
operaciones reserve=1
saldo final=0
```

Los fixtures QA se eliminaron de la base local al terminar. Producción nunca se
usó para esta prueba.

### TypeScript

- Vitest: 3 archivos, 20 pruebas, 20 aprobadas.
- Incluye prueba exhaustiva de todas las distribuciones válidas de estados para
  paquetes de 0 a 8 sesiones.
- `tsc --noEmit`: aprobado.
- ESLint focalizado: aprobado.
- Build optimizado de Next.js: aprobado (22 páginas estáticas generadas).
- `supabase db lint --local --level warning`: sin errores de esquema.

La primera ejecución de Vitest dentro del sandbox falló antes de cargar pruebas
por un `EPERM` al renombrar caché temporal. Repetida fuera del sandbox con la
misma suite, aprobó 20/20; no fue un fallo funcional.

## Reversión comprobada

Se aplicaron las dos migraciones, se ejecutaron primero el rollback de dueño y
luego el rollback base, y se volvió a exportar el esquema. `pg_dump` genera un
token aleatorio `\\restrict`, por lo que el hash crudo cambia. Tras excluir
únicamente ese token no semántico, los esquemas anterior y posterior fueron
idénticos:

```text
SHA-256 normalizado antes = FD1358066519B2B0F0CE02DE8F6F98D8E98626FA2DD6BA7F3EBA97C605CDA1A7
SHA-256 normalizado después = FD1358066519B2B0F0CE02DE8F6F98D8E98626FA2DD6BA7F3EBA97C605CDA1A7
semantic_equal=true
```

Después del ensayo se reaplicó H8 en local para dejar preparado H9.

## Respaldo local

El respaldo previo está fuera de Git en
`backups/sprint-1/local-h8-2026-11-04/`. Contiene esquema, datos y dumps de
comparación. El dump de datos conserva FKs circulares entre reservas y paquetes;
una restauración completa debe seguir el procedimiento del proyecto y desactivar
triggers durante la carga, no importar el archivo a ciegas.

Este respaldo sigue siendo una copia local con datos personales. No reemplaza
el requisito de respaldo fresco y segunda copia cifrada antes de cualquier
salida a producción.

## Hallazgos corregidos durante la validación

Se detectaron y corrigieron antes del cierre: un paréntesis inválido del
validador JSON, el grant mínimo necesario para validar reglas, una aserción de
auditoría ejecutada con rol sin permiso, un actor huérfano de `auth.users` en la
copia local, aislamiento insuficiente del fixture de concurrencia y una función
marcada `IMMUTABLE` que debía ser `STABLE`. El linter y todas las suites pasaron
después de las correcciones.

## Próximo hito

H9 debe implementar el panel para registrar compras, visualizar saldo y línea
de tiempo, agendar con disponibilidad real, cerrar sesiones con sugerencia y
motivo, extender vigencia y listar próximos vencimientos. Hasta que H9 y su
aceptación terminen, no se activa ningún paquete universal real.
