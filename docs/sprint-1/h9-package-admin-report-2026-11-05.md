# H9 — panel operativo de paquetes universales

Estado: completado y validado en Supabase local. No aplicado a producción, no
publicado y sin modificar datos de la clienta.

## Resultado funcional

El editor universal ahora permite configurar la modalidad `package` sin
inventar reglas. La persona operadora debe definir explícitamente sesiones,
vigencia, inicio de vigencia, separación opcional, aviso, reprogramaciones,
consumo por ausencia o liberación tardía, seña opcional y aclaraciones. Cada
propuesta puede sobrescribir esos valores y conserva sus propias reglas.

El módulo `/admin/paquetes` mantiene intacto el circuito histórico y agrega una
sección separada para paquetes universales con:

- registro de compra desde una pre-reserva elegible;
- confirmación atómica de la reserva cuando se registra seña o pago total;
- avance monotónico del estado de pago;
- saldo derivado y línea de tiempo por sesión;
- asignación y reprogramación usando disponibilidad real;
- cierre como completada, liberada o perdida;
- sugerencia basada en reglas congeladas y motivo obligatorio en excepciones;
- extensión motivada con protección contra formularios desactualizados;
- resumen de paquetes próximos a vencer;
- datos mínimos del cliente necesarios para operar.

La activación pública de `package` sigue bloqueada deliberadamente hasta H10.
No se creó ni activó un tratamiento real.

## Integridad agregada

La migración aditiva
`supabase/migrations/20261105000100_universal_service_packages_admin_h9.sql`
agrega únicamente tres RPC. No redefine funciones H8, policies, tablas ni
objetos legacy:

1. `register_service_package_purchase_v2`: registra compra y confirma la
   reserva inicial en una sola transacción; rechaza replays con un estado de
   pago contradictorio.
2. `update_service_package_payment`: solo permite avanzar el pago y no duplica
   historial al repetir la operación.
3. `extend_service_package_validity_v2`: usa idempotencia y compara la vigencia
   que veía el panel con la vigente bajo bloqueo de fila.

Las acciones del panel generan claves idempotentes por operación semántica. Un
doble envío repite la misma clave, pero una sesión futura, otra decisión o una
nueva extensión reciben claves distintas. Esto se cubre con pruebas unitarias.

## Seguridad

- Las tres funciones son `SECURITY DEFINER` con `search_path = ''`.
- El dueño es `service_package_rpc_executor`, no `postgres`.
- `PUBLIC` y `anon` no tienen `EXECUTE`; solo `authenticated` recibe el grant.
- La autorización real se valida de nuevo con `public.is_admin(auth.uid())`.
- No se agregaron datos personales a logs ni a `audit_log`.
- Matriz: `docs/sprint-1/rls-matrix-h9.md`.

## Reversión comprobada

Rollback:
`docs/sprint-1/sql/20261105000100_universal_service_packages_admin_h9.rollback.sql`.

Se aplicó H9 localmente, se exportó el catálogo efectivo, se ejecutó el
rollback y se volvió a exportar. Comparado con la línea base H8 autorizada:

```text
Diferencias nuevas de esquema tras rollback: 0
```

Después se reaplicó H9. El verificador informó exactamente nueve adiciones:
tres funciones y seis grants de función (tres para `authenticated` y tres para
el dueño restringido). No hubo objetos existentes modificados o eliminados.

Los snapshots locales están fuera de Git en:

- `backups/sprint-1/local-h9-final-2026-11-05/`
- `backups/sprint-1/local-h9-after-rollback-v2-2026-11-05/`

## Validación final

- Suite SQL H9: aprobada y finalizada con `ROLLBACK`.
- `supabase db lint --local --level warning`: cero errores.
- Vitest focalizado: 28/28.
- Suite completa: 88 archivos, 289/289 pruebas.
- TypeScript estricto: aprobado.
- ESLint completo: cero errores y cero advertencias.
- Build optimizado Next.js: aprobado; 22 páginas estáticas generadas.
- `git diff --check`: aprobado.

Durante la revisión se detectó un parche de idempotencia aplicado parcialmente
por la interrupción anterior. Se corrigió antes de cerrar: el circuito legacy
recuperó su clave original, cada acción universal quedó asociada a su operación
correcta y se añadió cobertura que impide reutilizar claves para sesiones
posteriores.

## Próximo hito

H10 debe ejecutar la aceptación local completa del release 2: compra desde
pre-reserva, tres sesiones, completar, liberar a tiempo, liberar tarde con
excepción motivada, cambio posterior de reglas sin alterar el snapshot vendido,
vencimiento, extensión y saldo correcto. Solo después corresponde elaborar la
salida a preview; producción continúa fuera de alcance sin autorización expresa.
