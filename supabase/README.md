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
