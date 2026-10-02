# Piel Canela

Web pública, catálogo de tratamientos, pre-reservas y administración operativa para Piel Canela, desarrollada por Kai Studio.

## Estado

- La web pública consulta catálogo, disponibilidad y pre-reservas reales cuando `NEXT_PUBLIC_DATA_SOURCE=supabase`.
- La fundación remota vive en Supabase, proyecto `dlrdlwjighvcyhirwgfu`.
- La fuente de datos se cambia mediante `NEXT_PUBLIC_DATA_SOURCE`.
- El backend autoasigna únicamente profesionales habilitados para el tratamiento e impide que una misma persona reciba turnos superpuestos. La capacidad por especialidad se conserva como barrera operativa secundaria.
- La administración dispone de agenda diaria, semanal e histórica con filtros y paginación real, asignación manual de turnos, horarios habituales, bloqueos y aperturas excepcionales.
- Las especialidades pueden crearse como activas o futuras y definen las ventanas base; cada profesional puede tener disponibilidad y bloqueos propios.
- Los Especiales del mes se crean y editan desde el panel con vigencia, precio e imagen.
- `/admin/catalogo` permite crear borradores, publicar y editar tratamientos, precios, duración, margen entre turnos y asignación profesional. La imagen es opcional: puede cargarse, reemplazarse y encuadrarse en cualquier momento sin bloquear el alta.
- `/admin/profesionales` mantiene perfiles internos y públicos reutilizables por múltiples especialidades y tratamientos.
- Los turnos manuales usan disponibilidad real, profesional específico o autoasignación y, cuando corresponde, combos con extras autorizados.
- `/admin/historial` ofrece trazabilidad operativa y restauración individual con control de versión para evitar sobrescribir cambios posteriores.
- `/admin/clientes` busca y pagina el directorio desde la base, y carga el historial únicamente para los perfiles visibles.
- La ventana de días del calendario público responde a `maximum_advance_days`, configurado por la administración y validado nuevamente por PostgreSQL.
- Los cambios que afectan reservas futuras exigen una confirmación explícita y cada tratamiento dispone de vista previa administrativa protegida.
- `/admin/contenido` permite a los perfiles operativos editar, previsualizar, publicar y restaurar los campos aprobados de una estructura fija. Los controles de estructura, acceso y gobierno interno continúan reservados a Kai Studio.
- `/admin/seguridad` es exclusivo del propietario técnico: permite asignar gestión operativa al cliente, habilitar o revocar cuentas verificadas y consultar actividad sin revelar campos privados.
- Los cambios de estado de una reserva son atómicos, respetan una máquina de estados y conservan actor, fecha y motivo. Cancelaciones y ausencias requieren una explicación operativa.
- Las pre-reservas vencidas se liberan automáticamente cada cinco minutos y las condiciones públicas se exponen en páginas legales enlazadas desde el sitio.
- Vercel Analytics y Speed Insights observan uso y rendimiento sin incorporar un panel de métricas decorativas.
- Las fotografías actuales son ejemplares y deben reemplazarse por material aprobado del cliente antes del lanzamiento definitivo.
- Producción se mantiene en estado `beta`: muestra un aviso visible, usa Supabase y bloquea la indexación hasta que el contenido real sea aprobado.

## Desarrollo

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

Usá `NEXT_PUBLIC_DATA_SOURCE=fixtures` para la demo y `NEXT_PUBLIC_DATA_SOURCE=supabase` para los datos reales.

El editor de contenido requiere dos secretos exclusivos del servidor:

```text
AGENCY_CONTENT_UNLOCK_CODE_HASH=<sha256 del código acordado>
AGENCY_CONTENT_SESSION_SECRET=<secreto aleatorio de firma>
```

El código en texto plano no se guarda en la aplicación ni en Supabase.

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Supabase

Las migraciones y decisiones operativas están en [`supabase/README.md`](supabase/README.md).

No se deben guardar contraseñas, access tokens, claves `service_role` ni datos personales en el repositorio.
