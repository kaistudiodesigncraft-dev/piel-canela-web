# Piel Canela

Web pública, catálogo de tratamientos, pre-reservas y administración operativa para Piel Canela, desarrollada por Kai Studio.

## Estado

- La experiencia visual aprobada continúa disponible con fixtures.
- La fundación remota vive en Supabase, proyecto `dlrdlwjighvcyhirwgfu`.
- La fuente de datos se cambia mediante `NEXT_PUBLIC_DATA_SOURCE`.
- El backend permite simultaneidad entre especialidades distintas e impide solapamientos dentro de una misma especialidad.
- La administración puede definir horarios habituales por especialidad.

## Desarrollo

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

Usá `NEXT_PUBLIC_DATA_SOURCE=fixtures` para la demo y `NEXT_PUBLIC_DATA_SOURCE=supabase` para los datos reales.

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
