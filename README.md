# Piel Canela

Web pública, catálogo de tratamientos, pre-reservas y administración operativa para Piel Canela, desarrollada por Kai Studio.

## Estado

- La web pública consulta catálogo, disponibilidad y pre-reservas reales cuando `NEXT_PUBLIC_DATA_SOURCE=supabase`.
- La fundación remota vive en Supabase, proyecto `dlrdlwjighvcyhirwgfu`.
- La fuente de datos se cambia mediante `NEXT_PUBLIC_DATA_SOURCE`.
- El backend permite simultaneidad entre especialidades distintas e impide solapamientos dentro de una misma especialidad.
- La administración dispone de agenda filtrable, asignación manual de turnos, horarios habituales, bloqueos y aperturas excepcionales.
- Las especialidades pueden crearse como activas o futuras y controlan la capacidad simultánea.
- Los Especiales del mes se crean y editan desde el panel con vigencia, precio e imagen.
- `/admin/catalogo` permite crear borradores, publicar y editar tratamientos, precios, duración, margen entre turnos, asignación profesional e imagen propia por tratamiento con vista previa y control de encuadre.
- `/admin/profesionales` mantiene perfiles internos y públicos reutilizables por especialidad.
- Los cambios que afectan reservas futuras exigen una confirmación explícita y cada tratamiento dispone de vista previa administrativa protegida.
- `/admin/contenido` permite a Kai Studio modificar los textos y la imagen principal sobre una estructura fija. Requiere rol propietario y un segundo código temporal; las cuentas `manager` del cliente no tienen acceso.
- `/admin/seguridad` es exclusivo del propietario técnico: permite asignar gestión operativa al cliente, habilitar o revocar cuentas verificadas y consultar actividad sin revelar campos privados.
- El alta del cliente se realiza desde `/admin/seguridad` mediante un QR de activación de un solo uso. Supabase genera el enlace sin enviar email y la persona define su propia contraseña desde su dispositivo.
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
SUPABASE_SECRET_KEY=<clave sb_secret exclusiva del servidor>
```

El código en texto plano no se guarda en la aplicación ni en Supabase.
`SUPABASE_SECRET_KEY` habilita operaciones administrativas de Auth y nunca debe usar el prefijo `NEXT_PUBLIC_`, aparecer en logs o llegar al navegador.

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
