# H10 — aceptación local de paquetes universales

Estado: **completado y aprobado en Supabase local**. No fue aplicado a
producción, no se modificaron datos de la clienta y no se desplegó código.

## Alcance cerrado

- Se habilitó la modalidad neutral `package` en el guard de preparación y en la
  RPC neutral `get_booking_order_context_v2`.
- No se modificaron funciones, tablas, policies ni datos del circuito histórico
  de Depilación.
- La selección pública muestra únicamente propuestas `kind=package`, cantidad
  de sesiones, duración por sesión y condiciones generadas desde las mismas
  reglas que usa el motor.
- La pre-reserva agenda solo la primera sesión. La compra se activa desde el
  panel al registrar el pago y conserva un snapshot de reglas.
- Una modalidad paquete rechaza una selección sin paquete y cualquier opción
  suelta añadida.

## Hallazgo corregido durante la aceptación

La primera corrida detectó que H3 todavía conservaba el bloqueo deliberado
`package_flow_not_enabled`. El editor podía definir un paquete, pero la RPC
pública no podía cotizarlo. H10 redefine exclusivamente la RPC neutral, mantiene
su firma y grants, y valida que el paquete elegido sea activo, tenga precio y no
reciba opciones sueltas.

También se corrigió la transferencia de `package_rules` entre el catálogo
obtenido de Supabase y el catálogo en memoria del selector público. Sin esa
transferencia, las reglas podían existir en base pero no mostrarse al usuario.

## Migración y reversión

- Migración:
  `supabase/migrations/20261105000200_enable_universal_service_packages_h10.sql`.
- Rollback:
  `docs/sprint-1/sql/20261105000200_enable_universal_service_packages_h10.rollback.sql`.
- Diferencias esperadas frente a H9: exactamente dos funciones neutrales
  modificadas:
  - `public.enforce_configured_treatment_readiness()`;
  - `public.get_booking_order_context_v2(uuid,uuid,uuid[])`.
- Ensayo de rollback contra el esquema H9 real: **0 diferencias**.
- Snapshot H10 local ignorado por Git:
  `backups/sprint-1/local-h10-final-2026-11-06/`.
- Snapshot posterior al rollback ignorado por Git:
  `backups/sprint-1/local-h10-after-rollback-2026-11-06/`.

## Aceptación funcional

La suite `supabase/tests/universal_service_packages_acceptance_h10.sql` se
ejecuta dentro de una transacción y finaliza con `ROLLBACK`. Validó:

1. catálogo público y reglas visibles para `anon`;
2. rechazo de paquete ausente y de opciones sueltas en un paquete;
3. cotización firmada `booking-order-v2`;
4. disponibilidad y pre-reserva de la primera sesión;
5. registro de compra y confirmación del pago;
6. snapshot de reglas inmutable ante cambios futuros de la propuesta;
7. sesión completada;
8. sesión liberada dentro de plazo;
9. liberación tardía con sugerencia `lost`, corrección administrativa,
   motivo obligatorio y auditoría sin datos personales;
10. vencimiento derivado, bloqueo de nuevas sesiones y extensión auditada;
11. saldo final correcto: tres sesiones disponibles, una completada y dos
    liberadas.

Ningún fixture quedó persistido.

## Compuertas de calidad

- SQL H9 + H10: aprobado.
- `supabase db lint --local --level warning`: cero errores.
- Vitest completo: 88 archivos, **292/292** pruebas.
- TypeScript estricto: aprobado.
- ESLint: cero errores y cero advertencias.
- Build Next.js de producción: aprobado, 22 páginas generadas.
- `git diff --check`: aprobado.

## Estado para la carga de tratamientos nuevos

En local, el editor universal ya admite, sin código por tratamiento:

- tratamiento simple;
- opciones sueltas;
- combos cerrados;
- combos con adicionales y descuento propio;
- paquetes de sesiones.

La clienta **todavía no debe cargar HIFU mediante este circuito en producción**:
H2–H10 continúan únicamente en la rama local. Antes de habilitarlo se requieren
la reconciliación H-12, un respaldo fresco de producción, confirmar la segunda
copia cifrada, aplicar las migraciones en orden, desplegar a preview y ejecutar
un humo con un tratamiento de prueba no publicado. Esa es la ruta mínima segura;
omitirla arriesgaría el catálogo ya lanzado.
