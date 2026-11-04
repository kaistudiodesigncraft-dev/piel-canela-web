# Respaldo verificado y restauración controlada

## Ubicación

```text
C:\Users\Usuario\.codex\.chatgpt-projects\g-p-6a6934b02b088191b6e747e7bf181ed3\backups\sprint-0\2026-10-28_013257
```

La carpeta está excluida de Git porque contiene datos personales. `git check-ignore` la identifica mediante la regla `/backups/`.

## Contenido

- `raw/production-data-export.csv`: respuesta original del export SELECT-only.
- `data/*.json`: 31 tablas, una por archivo.
- `manifest.json`: conteo, tamaño y SHA-256 por archivo.
- `backup-verification.json`: resumen de consistencia.
- `schema/migrations/`: las 54 migraciones versionadas que reconstruyen tablas, constraints, índices, policies, funciones y triggers.
- `schema-manifest.json`: checksum de cada migración.
- `restore-data.sql`: importador lógico transaccional generado para una base aislada y vacía.
- `restore-manifest.json`: checksum y conteo del importador.

## Verificación

| Control | Resultado |
|---|---:|
| Tablas exportadas | 31 |
| Filas en origen | 2.310 |
| Filas decodificadas | 2.310 |
| Diferencias de conteo | 0 |
| Referencias rotas | 0 |
| Migraciones de esquema | 54 |

Checksums principales:

- export original: `ce581da2e0376d2dde87544bff2610494aab42dfc1290311bfd0d710dbd6cdec`
- manifiesto de datos: `2d533e9ecee13b9bb85b8c62124669a9ed32b1d93c88898310a87bd87bc73be5`
- manifiesto de esquema: `ecc2c0e1b8a602b3d5e1d0a88b09d09ea520560307ea21a2cb3a9edf7eedf3d1`
- importador lógico: `048ba7eb591c389fb4fd78263741efced8abba46d8f08aca3e9a7a4ec26734b2`

El inventario efectivo de producción observado por consulta de catálogo contiene 395 columnas, 241 constraints, 84 índices, 52 policies, 87 funciones, 56 triggers, 37 tablas con RLS y 713 grants. No se obtuvo una conexión PostgreSQL directa para generar un `pg_dump`; por eso se usó la alternativa permitida: datos JSON verificables más historial completo de migraciones. Antes de cualquier restauración real debe ensayarse este conjunto en una base aislada.

## Restauración — no ejecutada

Solo sobre una instancia local o proyecto temporal vacío:

```powershell
$backup = "C:\Users\Usuario\.codex\.chatgpt-projects\g-p-6a6934b02b088191b6e747e7bf181ed3\backups\sprint-0\2026-10-28_013257"

# 1. Levantar Supabase local y reconstruir el esquema versionado sin seeds.
.\node_modules\.bin\supabase.cmd start
.\node_modules\.bin\supabase.cmd db reset --local --no-seed

# 2. Las migraciones incluyen datos iniciales. Vaciar las 31 tablas de negocio
# únicamente en esta instancia aislada, conservando el esquema.

# 3. Importar las 2.310 filas. El SQL deshabilita triggers solo durante
# la transacción local y aborta sin la confirmación explícita.
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" `
  -v ON_ERROR_STOP=1 `
  -v SPRINT0_RESTORE_CONFIRMED=1 `
  -f "$backup\restore-data.sql"

# 4. Comparar contra la línea base.
node --no-warnings scripts\verify-baseline.ts --snapshot $backup
```

Para verificar integridad de archivos antes de restaurar:

```powershell
Get-FileHash "$backup\raw\production-data-export.csv" -Algorithm SHA256
Get-FileHash "$backup\restore-data.sql" -Algorithm SHA256
```

No se debe ejecutar `restore-data.sql` contra producción ni contra una base con datos. El script usa una transacción y falla ante conflictos; no contiene `TRUNCATE`, `DROP` ni borrado.

