# Preview 2026-10-02

## Propósito

Registro sanitizado para vincular el preview de Vercel con el estado del catálogo visible al momento de liberar. No es un backup y no contiene datos personales.

## Inventarios

- `public-inventory.json`: lectura mediante el rol público y las RLS de la web.
- `supabase/audits/production_inventory.sql`: inventario privado recomendado para ejecutar en Supabase y conservar fuera del repositorio.

Los conteos de reservas, clientes, auditoría y objetos privados de Storage no se versionan. El respaldo operativo debe permanecer en almacenamiento privado de Kai Studio.

## Migraciones declaradas como aplicadas

- `20260930000100_booking_integrity.sql`
- `20260930000200_atomic_catalog_and_history.sql`
- `20260930000300_protected_action_limits.sql`
- `20260930000400_manual_booking_extras.sql`
- `20260930000500_legacy_selection_lint.sql`

La aplicación remota fue confirmada por el operador el 2 de octubre de 2026; este archivo no sustituye una consulta del historial remoto.

## Verificación previa

- ESLint aprobado.
- TypeScript aprobado.
- 53 archivos y 163 pruebas de la suite completa aprobados, más las pruebas nuevas de idempotencia.
- Build de producción aprobado con Next.js 16.3.6.
- Auditoría de dependencias sin vulnerabilidades conocidas.
- Base local reconstruida desde cero y linter PostgreSQL sin hallazgos.
- Pruebas SQL de agenda, paquetes, restauración y RLS aprobadas con `ROLLBACK`.

## Regla de liberación

Este commit puede desplegarse en Vercel Preview. No debe promoverse a producción hasta completar smoke autenticado, carga real de medios y comparación del inventario privado posterior.
