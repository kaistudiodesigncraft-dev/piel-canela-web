# Aceptación local H6 — plantilla universal

Fecha: 2026-11-04. Producción permaneció en solo lectura. No hubo push, merge
ni deploy.

## Resultado ejecutivo

Las modalidades `simple`, `options`, `closed_combos` y
`combos_with_addons` se configuraron desde el editor y completaron el circuito
público contra Supabase local. `package` continúa bloqueado por diseño para el
release 2.

La configuración universal permanece apagada para todo tratamiento real:

- configuraciones activas: 4, todas fixtures `H6 ... QA`;
- tratamientos reales con `config_enabled=true`: 0;
- tratamientos legacy sin activar: 21.

## Aceptación desde el editor y el flujo público

| Modalidad | Selección | Precio | Duración | Snapshot |
|---|---|---:|---:|---|
| Simple | sin variantes | $15.000 | 30 min | `booking-order-v2`, sin ítems |
| Opciones | Alfa + Beta | $12.000 | 45 min | dos opciones y total autoritativo |
| Combo cerrado | Combo Cerrado H6 | $8.500 | 35 min | combo e incluidas congelados |
| Combo + adicionales | combo + dos adicionales | $14.200 | 45 min | subtotal $15.000, descuento 10 %/$800 |

En los cuatro casos se verificaron disponibilidad, asignación profesional,
pre-reserva, código de reserva y enlace de WhatsApp. Los datos usados son QA y
existen únicamente en la base local.

## E2E, responsive y accesibilidad

Prueba: `tests/e2e/universal-booking-h6.spec.ts`.

Esta aceptación requiere los cuatro tratamientos QA cargados en un Supabase
local aislado y se ejecuta con `pnpm test:e2e:h6`. El smoke habitual
`pnpm test:e2e` usa fixtures estáticos y la excluye de forma explícita porque
ese entorno no dispone de RPC ni permite crear pre-reservas reales.

- 12/12 recorridos completos aprobados: cuatro modalidades en 375, 768 y
  1440 px;
- 4/4 controles de teclado, foco inicial y axe WCAG A/AA aprobados;
- sin desborde horizontal en los tres anchos;
- el límite antiabuso permaneció activo: cada caso automatizado representó una
  conexión independiente, sin deshabilitar la protección.

La primera corrida detectó contraste 3,56:1 en las etiquetas pequeñas de
precio/duración. Se cambió únicamente su color a blanco; la segunda corrida no
registró violaciones serias o críticas.

## Bordes y autoridad del servidor

- duplicados y una opción ya incluida: rechazados;
- menos del mínimo y más del máximo: rechazados;
- opción inactiva: rechazada;
- opción sin precio válido: rechazada;
- payload o total alterado: rechazado por firma o `price_changed`;
- cotización obsoleta tras cambiar catálogo: rechazada;
- tratamiento legacy: no ingresa en la RPC genérica;
- snapshots: conservan precio, duración, selección, configuración y propósito
  `booking-order-v2`.

Evidencia: `src/lib/booking-engine.test.ts`,
`src/app/(public)/reservar/booking-order-actions.test.ts` y
`supabase/tests/universal_booking_rpc_h3.sql`.

## Regresión de Depilación

La equivalencia aprobó contra los cuatro respaldos disponibles (28/10, 29/10,
02/11 y 03/11). Por respaldo: 14 combos, 210 pares, 100 muestras con semilla de
3 a 6 zonas, 28 casos combo + adicionales, 14 rechazos de zona incluida y dos
snapshots históricos. Totales: 56 combos, 840 pares, 400 muestras, 112 casos
con adicionales, 56 rechazos y 8 comparaciones de snapshot; cero diferencias.

Pendiente de cierre externo: el MCP de producción rechazó la renovación OAuth
el 04/11. Por eso la equivalencia está certificada hasta el respaldo fresco del
03/11, no contra una lectura nueva del 04/11. No se accedió a datos personales
ni se intentó escritura.

## Verificador y seguridad

- matriz RLS H5: 36/36 celdas aprobadas;
- diferencias H2–H5: 97 informativas, 0 bloqueantes, 0 “otros”;
- rol público efectivo: `anon`;
- rol admin: tabla de servidor `profiles`, no metadata editable;
- H-12: ocho funciones pendientes de reconciliación antes de producción (seis
  cosméticas y dos lógicas). No se ejecutó la reconciliación.

## Estado de H6

**Aceptación local funcional: aprobada.** La salida a producción sigue
bloqueada por las compuertas deliberadas: lectura fresca de producción,
segunda copia cifrada confirmada y reconciliación H-12.

