# Matriz de acceso H9 — operación administrativa de paquetes

H9 no agrega tablas ni modifica policies. Conserva la RLS de H8 y agrega tres
RPC de frontera para el panel. Todas validan `public.is_admin(auth.uid())`, son
`SECURITY DEFINER`, fijan `search_path = ''`, usan objetos con esquema explícito
y pertenecen al rol restringido `service_package_rpc_executor`.

| Frontera | anon | authenticated sin rol operativo | admin/manager activo |
|---|---:|---:|---:|
| `register_service_package_purchase_v2` | sin `EXECUTE` | rechaza `admin_required` | permite registrar compra y confirmar reserva en una sola transacción |
| `update_service_package_payment` | sin `EXECUTE` | rechaza `admin_required` | permite avance monotónico del pago y confirma la reserva |
| `extend_service_package_validity_v2` | sin `EXECUTE` | rechaza `admin_required` | permite extensión motivada, idempotente y con control de versión |

Las RPC H8 subyacentes conservan sus grants y comportamiento. La lectura y
escritura directa de `service_package_contracts`, `service_package_sessions` y
`service_package_operations` continúa regida por la matriz H8.

## Evidencia local

`supabase/tests/universal_service_packages_admin_h9.sql` verificó:

- `anon` sin `EXECUTE` y `authenticated` con grant en las tres fronteras;
- autorización operativa dentro de cada función;
- alta y replay idempotente de una compra;
- una sola transición de estado de la reserva;
- rechazo de un replay con estado de pago contradictorio;
- actualización de pago idempotente;
- extensión idempotente y rechazo de una pantalla desactualizada.

La suite usa una transacción y finaliza con `ROLLBACK`; no conserva fixtures.
