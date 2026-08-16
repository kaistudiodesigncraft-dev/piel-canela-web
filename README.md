# Piel Canela

Web pública, catálogo de tratamientos, pre-reservas y administración operativa para Piel Canela, desarrollada por Kai Studio.

## Estado

- La web pública consulta catálogo, disponibilidad y pre-reservas reales cuando `NEXT_PUBLIC_DATA_SOURCE=supabase`.
- La fundación remota vive en Supabase, proyecto `dlrdlwjighvcyhirwgfu`.
- La fuente de datos se cambia mediante `NEXT_PUBLIC_DATA_SOURCE`.
- El backend permite simultaneidad entre especialidades distintas e impide solapamientos dentro de una misma especialidad.
- La administración puede definir horarios habituales por especialidad.
- `/admin/contenido` permite modificar los textos y la imagen principal sobre una estructura fija. Requiere sesión administrativa y un segundo código temporal.

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
