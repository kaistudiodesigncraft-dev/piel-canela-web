# Supabase de Piel Canela

Proyecto remoto previsto: `dlrdlwjighvcyhirwgfu`.

## Decisión operativa

Las categorías ordenan el catálogo; las especialidades controlan capacidad. Dos turnos pueden ocurrir al mismo tiempo si pertenecen a especialidades distintas. Para estados que ocupan agenda (`pending`, `awaiting_deposit`, `confirmed`), la base impide cualquier solapamiento dentro de la misma especialidad.

La administración define horarios habituales en `availability_rules` y aperturas o bloqueos excepcionales en `availability_exceptions`.

La asignación manual se ejecuta mediante `create_admin_booking`: una operación atómica exclusiva de administradores que vuelve a validar el tratamiento, el especial vigente y los solapamientos antes de guardar cliente y reserva. La migración `20260816000500_sprint_one_admin_operations.sql` incorpora este contrato y los índices operativos de Sprint 1.

La migración `20260821000600_sprint_two_catalog_integrity.sql` completa el contrato del catálogo: evita profesionales duplicados dentro de una especialidad, acelera la consulta de reservas futuras por tratamiento y valida en base de datos que un profesional asignado pertenezca a la misma especialidad. Un tratamiento publicado no puede depender de un profesional inactivo.

`site_content` contiene exclusivamente los campos institucionales aprobados. La aplicación solo tiene permiso para actualizar valores, texto alternativo y rutas de imagen; no puede crear o eliminar filas. Las imágenes institucionales se almacenan separadas de tratamientos en `site-content-media`.

La migración `20260821000800_sprint_four_governance_and_history.sql` incorpora gobierno operativo: historial explícito de estados de reserva, transición transaccional validada en servidor, motivo obligatorio para cancelación y ausencia, marcas temporales de confirmación/realización y control sobre altas o bajas de accesos existentes. La cuenta en uso y el último administrador activo no pueden revocarse.

Las migraciones `20260823000900_sprint_five_launch_readiness.sql` y `20260823000910_sprint_five_client_permissions.sql` completan la preparación de lanzamiento: programan el vencimiento de pre-reservas cada cinco minutos, publican las condiciones operativas necesarias y separan el rol de propietario técnico (`admin`) del rol de gestión del cliente (`manager`). Ambos pueden operar el negocio; solo el propietario gestiona accesos y consulta auditoría.

La migración `20260823000920_owner_content_boundary.sql` extiende esa frontera al editor institucional y a sus imágenes: solo Kai Studio (`admin`) puede modificar `site_content` o `site-content-media`. La migración `20260823000930_treatment_publication_integrity.sql` vuelve autoritativas en PostgreSQL las reglas mínimas de publicación: precio positivo, imagen con texto alternativo y taxonomía activa. Los borradores siguen admitidos y las reservas históricas no dependen de que el tratamiento continúe publicado.

## Alta segura de una cuenta cliente

1. El propietario técnico genera el acceso desde `/admin/seguridad` con el correo confirmado por el cliente.
2. El servidor utiliza `auth.admin.generateLink`; esta operación genera el enlace pero no envía email.
3. El UUID resultante se vincula a `public.profiles` con rol `manager` e `is_active = true` y el alta queda registrada en la auditoría privada.
4. El QR se muestra únicamente en la sesión propietaria. La persona lo escanea, establece su propia contraseña y el enlace queda inutilizable después del primer uso o su vencimiento.
5. Verificar acceso operativo y rechazo de `/admin/contenido` y `/admin/seguridad`.

El cliente administrativo usa una clave `sb_secret_` independiente en `SUPABASE_SECRET_KEY`. Solo existe en el servidor de Vercel, no usa prefijo `NEXT_PUBLIC_` y nunca debe persistirse en base de datos, logs, respuestas de error o Git. `/auth/complete` debe estar incluido entre los redirect URLs permitidos de Supabase Auth.

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
