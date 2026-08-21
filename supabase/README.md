# Supabase de Piel Canela

Proyecto remoto previsto: `dlrdlwjighvcyhirwgfu`.

## Decisión operativa

Las categorías ordenan el catálogo; las especialidades controlan capacidad. Dos turnos pueden ocurrir al mismo tiempo si pertenecen a especialidades distintas. Para estados que ocupan agenda (`pending`, `awaiting_deposit`, `confirmed`), la base impide cualquier solapamiento dentro de la misma especialidad.

La administración define horarios habituales en `availability_rules` y aperturas o bloqueos excepcionales en `availability_exceptions`.

La asignación manual se ejecuta mediante `create_admin_booking`: una operación atómica exclusiva de administradores que vuelve a validar el tratamiento, el especial vigente y los solapamientos antes de guardar cliente y reserva. La migración `20260816000500_sprint_one_admin_operations.sql` incorpora este contrato y los índices operativos de Sprint 1.

La migración `20260821000600_sprint_two_catalog_integrity.sql` completa el contrato del catálogo: evita profesionales duplicados dentro de una especialidad, acelera la consulta de reservas futuras por tratamiento y valida en base de datos que un profesional asignado pertenezca a la misma especialidad. Un tratamiento publicado no puede depender de un profesional inactivo.

`site_content` contiene exclusivamente los campos institucionales aprobados. La aplicación solo tiene permiso para actualizar valores, texto alternativo y rutas de imagen; no puede crear o eliminar filas. Las imágenes institucionales se almacenan separadas de tratamientos en `site-content-media`.

La migración `20260821000800_sprint_four_governance_and_history.sql` incorpora gobierno operativo: historial explícito de estados de reserva, transición transaccional validada en servidor, motivo obligatorio para cancelación y ausencia, marcas temporales de confirmación/realización y control sobre altas o bajas de accesos existentes. La cuenta en uso y el último administrador activo no pueden revocarse.

## Seguridad

- RLS está activo en todas las tablas expuestas.
- El público solo puede leer catálogo publicable y ejecutar las operaciones controladas de disponibilidad y pre-reserva.
- Reservas, clientes, configuración y auditoría requieren un perfil administrativo activo.
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
