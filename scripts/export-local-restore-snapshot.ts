import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [sourceRootArg, outputRootArg, containerArg] = process.argv.slice(2);

if (!sourceRootArg || !outputRootArg || !containerArg) {
  throw new Error(
    "Uso: node --experimental-strip-types scripts/export-local-restore-snapshot.ts <respaldo-fuente> <salida> <contenedor-local>",
  );
}

const expectedContainer =
  "supabase_db_g-p-6a6934b02b088191b6e747e7bf181ed3";

if (containerArg !== expectedContainer) {
  throw new Error(`Contenedor local no autorizado: ${containerArg}`);
}

const sourceRoot = resolve(sourceRootArg);
const outputRoot = resolve(outputRootArg);
const dataRoot = join(outputRoot, "data");
const schemaRoot = join(outputRoot, "schema");
const counts = JSON.parse(
  readFileSync(join(sourceRoot, "source-counts.json"), "utf8"),
) as Record<string, number>;

mkdirSync(dataRoot, { recursive: true });
mkdirSync(schemaRoot, { recursive: true });

for (const table of Object.keys(counts).sort()) {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) {
    throw new Error(`Nombre de tabla inseguro: ${table}`);
  }

  const sql = [
    "select coalesce(",
    "  jsonb_agg(to_jsonb(source_row) order by to_jsonb(source_row)::text),",
    "  '[]'::jsonb",
    `)::text from public.\"${table}\" as source_row;`,
  ].join(" ");
  const raw = execFileSync(
    "docker",
    [
      "exec",
      containerArg,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-AtXq",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
  const rows = JSON.parse(raw) as unknown[];
  if (rows.length !== counts[table]) {
    throw new Error(
      `${table}: origen=${counts[table]} restaurado=${rows.length}`,
    );
  }
  writeFileSync(
    join(dataRoot, `${table}.json`),
    `${JSON.stringify(rows, null, 2)}\n`,
    "utf8",
  );
}

const schemaScript = resolve("scripts/export-local-schema.sql");
execFileSync("docker", ["cp", schemaScript, `${containerArg}:/tmp/export-local-schema.sql`], {
  stdio: "inherit",
});
execFileSync(
  "docker",
  [
    "exec",
    containerArg,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "/tmp/export-local-schema.sql",
  ],
  { stdio: "inherit" },
);

for (const file of [
  "columns.json",
  "constraints.json",
  "functions.json",
  "policies.json",
  "function_grants.json",
  "triggers.json",
  "indexes.json",
  "tables_rls.json",
  "table_grants.json",
  "column_grants.json",
]) {
  execFileSync(
    "docker",
    ["cp", `${containerArg}:/tmp/${file}`, join(schemaRoot, basename(file))],
    { stdio: "inherit" },
  );
}

writeFileSync(
  join(outputRoot, "local-restore-source.json"),
  `${JSON.stringify(
    {
      sourceRoot,
      container: containerArg,
      exportedAt: new Date().toISOString(),
      tables: Object.keys(counts).length,
      rows: Object.values(counts).reduce((sum, count) => sum + count, 0),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  JSON.stringify({ outputRoot, tables: Object.keys(counts).length }, null, 2),
);
