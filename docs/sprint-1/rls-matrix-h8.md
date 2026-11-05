# H8 — Matriz RLS de paquetes universales

Fecha de verificación local: 2026-11-05. Producción no fue modificada.

Las tres tablas tienen RLS habilitado. `anon` no posee privilegios de tabla.
`authenticated` posee únicamente `SELECT`, condicionado por
`public.is_admin(auth.uid())`. Las escrituras directas están revocadas incluso
para un usuario operativo; las mutaciones pasan por las RPC transaccionales.

## Acceso directo por tabla

| Rol efectivo | Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---:|---:|---:|---:|
| `anon` | `service_package_contracts` | no | no | no | no |
| `anon` | `service_package_sessions` | no | no | no | no |
| `anon` | `service_package_operations` | no | no | no | no |
| `authenticated` sin rol operativo | `service_package_contracts` | 0 filas | no | no | no |
| `authenticated` sin rol operativo | `service_package_sessions` | 0 filas | no | no | no |
| `authenticated` sin rol operativo | `service_package_operations` | 0 filas | no | no | no |
| admin/manager activo | `service_package_contracts` | sí | no directo | no directo | no directo |
| admin/manager activo | `service_package_sessions` | sí | no directo | no directo | no directo |
| admin/manager activo | `service_package_operations` | sí | no directo | no directo | no directo |

## Escritura por operación

| Operación | `anon` | `authenticated` sin rol operativo | admin/manager activo |
|---|---:|---:|---:|
| Registrar compra | no | no | RPC |
| Reservar/reprogramar/cerrar sesión | no | no | RPC |
| Extender vigencia | no | no | RPC |
| Consultar sugerencia | no | no | RPC |
| Consultar disponibilidad | no | no | RPC |

Las cinco RPC públicas son `SECURITY DEFINER`, tienen `search_path=''`, dueño
`service_package_rpc_executor`, `EXECUTE` revocado a `PUBLIC` y `anon`, y
concedido solo a `authenticated`. El dueño es `NOLOGIN`, `NOSUPERUSER` y
`NOBYPASSRLS`; dispone únicamente de los grants enumerados en la migración de
propietario.

## Evidencia automatizada

`supabase/tests/universal_service_packages_h8.sql` comprueba:

- privilegios `SELECT/INSERT/UPDATE/DELETE` de los tres roles de API;
- denegación de lectura para `anon`;
- cero filas visibles para un usuario autenticado sin rol operativo;
- denegación de RPC y escritura directa al usuario no operativo;
- ejecución completa de las RPC con un usuario operativo real de la copia
  local.

El catálogo local confirmó para las cinco funciones:

```text
owner=service_package_rpc_executor
security_definer=true
search_path=""
anon_execute=false
authenticated_execute=true
```
