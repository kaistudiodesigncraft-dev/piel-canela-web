# Supabase de Piel Canela

Proyecto remoto previsto: `dlrdlwjighvcyhirwgfu`.

## Decisión operativa

Las categorías ordenan el catálogo; las especialidades controlan capacidad. Dos turnos pueden ocurrir al mismo tiempo si pertenecen a especialidades distintas. Para estados que ocupan agenda (`pending`, `awaiting_deposit`, `confirmed`), la base impide cualquier solapamiento dentro de la misma especialidad.

La administración define horarios habituales en `availability_rules` y aperturas o bloqueos excepcionales en `availability_exceptions`.

Desde `20260824001000_weekly_availability_editor.sql`, las reglas habituales representan únicamente las franjas semanales de una especialidad. La frecuencia de inicio se configura en `treatments.start_interval_minutes` (15, 30 o 60 minutos), mientras que la duración y el margen determinan cuánto tiempo ocupa una reserva. `replace_specialty_weekly_availability` reemplaza la semana completa en una sola transacción y conserva intactas las reservas existentes.

La asignación manual se ejecuta mediante `create_admin_booking`: una operación atómica exclusiva de administradores que vuelve a validar el tratamiento, el especial vigente y los solapamientos antes de guardar cliente y reserva. La migración `20260816000500_sprint_one_admin_operations.sql` incorpora este contrato y los índices operativos de Sprint 1.

La migración `20260821000600_sprint_two_catalog_integrity.sql` completa el contrato del catálogo: evita profesionales duplicados dentro de una especialidad, acelera la consulta de reservas futuras por tratamiento y valida en base de datos que un profesional asignado pertenezca a la misma especialidad. Un tratamiento publicado no puede depender de un profesional inactivo.

`site_content` contiene exclusivamente los campos institucionales aprobados. La aplicación solo tiene permiso para actualizar valores, texto alternativo y rutas de imagen; no puede crear o eliminar filas. Las imágenes institucionales se almacenan separadas de tratamientos en `site-content-media`.

La migración `20260821000800_sprint_four_governance_and_history.sql` incorpora gobierno operativo: historial explícito de estados de reserva, transición transaccional validada en servidor, motivo obligatorio para cancelación y ausencia, marcas temporales de confirmación/realización y control sobre altas o bajas de accesos existentes. La cuenta en uso y el último administrador activo no pueden revocarse.

Las migraciones `20260823000900_sprint_five_launch_readiness.sql` y `20260823000910_sprint_five_client_permissions.sql` completan la preparación de lanzamiento: programan el vencimiento de pre-reservas cada cinco minutos, publican las condiciones operativas necesarias y separan el rol de propietario técnico (`admin`) del rol de gestión del cliente (`manager`). Ambos pueden operar el negocio; solo el propietario gestiona accesos y consulta auditoría.

La migración `20260823000920_owner_content_boundary.sql` extiende esa frontera al editor institucional y a sus imágenes: solo Kai Studio (`admin`) puede modificar `site_content` o `site-content-media`. La migración `20260823000930_treatment_publication_integrity.sql` vuelve autoritativas en PostgreSQL las reglas mínimas de publicación: precio positivo, imagen con texto alternativo y taxonomía activa. Los borradores siguen admitidos y las reservas históricas no dependen de que el tratamiento continúe publicado.

La migración `20260823000940_public_booking_window.sql` permite al público leer únicamente `maximum_advance_days`. El calendario puede así representar la ventana elegida por la administración mientras `get_available_slots` conserva la validación autoritativa.

La migración `20260907001400_depilation_closed_combos.sql` agrega, sin transformar tratamientos existentes, el modo `closed_combo` para Depilación. Las zonas son reutilizables y los combos son opciones cerradas de una sesión o paquetes. Precio, duración, ahorro y vigencia se resuelven nuevamente en PostgreSQL; un especial mensual nunca modifica el precio de un combo. Solo la primera sesión se reserva online y confirmar su seña activa un paquete idempotente. Las sesiones posteriores quedan en cero y se registran como incluidas en el paquete.

La función permanece detrás de `business_settings.depilation_combos_enabled`. El orden de liberación es obligatorio:

1. Ejecutar `supabase/audits/production_inventory.sql` y conservar el resultado privado.
2. Aplicar la migración aditiva y repetir el inventario.
3. Confirmar que tratamientos, profesionales, especialidades, disponibilidades, reservas y objetos de Storage conservan sus IDs y conteos.
4. Desplegar el código compatible desde un commit identificado.
5. Crear o adaptar Depilación como borrador inactivo y cargar sus zonas y combos reales.
6. Con la bandera apagada, aprobar la vista previa administrativa y confirmar que los tratamientos simples siguen reservándose igual.
7. Habilitar la bandera, publicar Depilación y probar selector, disponibilidad, primera reserva, activación y consumo de paquete.
8. Si la validación falla, desactivar primero Depilación y recién después volver a apagar la bandera.

No se debe ejecutar `db reset`, seed productivo, truncate ni conversiones automáticas. Las RPC históricas delegan al contrato de selección y rechazan tratamientos configurables sin combo, evitando que integraciones antiguas salteen la nueva regla.

## Alta segura de una cuenta cliente

1. Enviar la invitación desde Supabase Auth al correo confirmado por el cliente.
2. Obtener el UUID generado y crear su fila en `public.profiles` con rol `manager` e `is_active = true`.
3. La persona invitada define su propia contraseña desde el enlace recibido; nunca se comparte una contraseña manual.
4. Verificar acceso operativo y rechazo de `/admin/contenido` y `/admin/seguridad`.

## Seguridad

- RLS está activo en todas las tablas expuestas.
- El público solo puede leer catálogo publicable y ejecutar las operaciones controladas de disponibilidad y pre-reserva.
- Reservas, clientes y configuración requieren un perfil operativo activo. La gestión de accesos y la lectura de auditoría requieren rol propietario.
- La interfaz de auditoría muestra qué entidad y campos cambiaron, pero no expone valores de teléfonos, correos, notas ni políticas internas.
- El rol administrador no se asigna automáticamente: primero se crea el usuario en Supabase Auth y luego se agrega su UUID a `profiles`.
- Nunca debe utilizarse una `service_role` en el navegador.

## Aplicación remota

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref dlrdlwjighvcyhirwgfu
pnpm exec supabase db push --dry-run
pnpm exec supabase db push
```

Antes de `db push`, revisar siempre el dry run y confirmar que se está conectado al proyecto correcto.

Antes y después de toda migración remota, ejecutar
`supabase/audits/production_inventory.sql`. El inventario no sustituye el
respaldo privado de tablas y Storage, pero permite detectar cualquier cambio
inesperado sin exponer datos personales.
