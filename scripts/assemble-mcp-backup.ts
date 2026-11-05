import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

type Row = Record<string, unknown>;
interface Chunk { source_count: number; offset: number; rows: Row[] }

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

const rootArgument = argument("--backup");
if (!rootArgument) throw new Error("Use --backup <directorio>.");
const root = resolve(rootArgument);
const chunksRoot = join(root, "raw-chunks");
const dataRoot = join(root, "data");
const schemaRoot = join(root, "schema");
mkdirSync(dataRoot, { recursive: true });

const manifest: Array<Record<string, unknown>> = [];
const sourceCounts: Record<string, number> = {};
const dataByTable: Record<string, Row[]> = {};
const countMismatches: Array<Record<string, unknown>> = [];

for (const table of readdirSync(chunksRoot).sort()) {
  const directory = join(chunksRoot, table);
  if (!statSync(directory).isDirectory()) continue;
  const chunks = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")) as Chunk)
    .sort((left, right) => left.offset - right.offset);
  if (chunks.length === 0) throw new Error(`${table} no contiene páginas.`);
  const sourceCount = chunks[0]!.source_count;
  const inconsistentCounts = [...new Set(chunks.map((chunk) => chunk.source_count))];
  const rows = chunks.flatMap((chunk) => chunk.rows);
  if (inconsistentCounts.length !== 1 || rows.length !== sourceCount) {
    countMismatches.push({ table, sourceCount, observedCounts: inconsistentCounts, fileRows: rows.length });
  }
  const serialized = `${JSON.stringify(rows, null, 2)}\n`;
  const path = join(dataRoot, `${table}.json`);
  writeFileSync(path, serialized, "utf8");
  sourceCounts[table] = sourceCount;
  dataByTable[table] = rows;
  manifest.push({
    table,
    source_rows: sourceCount,
    file_rows: rows.length,
    sha256: sha256(serialized),
    bytes: Buffer.byteLength(serialized),
    file: `data/${table}.json`,
  });
}

function ids(table: string): Set<string> {
  return new Set((dataByTable[table] ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string"));
}

const references: Array<[string, string, string, string]> = [
  ["treatments", "category_id", "treatment_categories", "id"],
  ["treatments", "specialty_id", "specialties", "id"],
  ["treatments", "professional_id", "professionals", "id"],
  ["bookings", "treatment_id", "treatments", "id"],
  ["bookings", "customer_id", "customers", "id"],
  ["bookings", "professional_id", "professionals", "id"],
  ["bookings", "treatment_combo_id", "treatment_combos", "id"],
  ["bookings", "customer_package_id", "customer_packages", "id"],
  ["treatment_combos", "treatment_id", "treatments", "id"],
  ["treatment_combo_zones", "combo_id", "treatment_combos", "id"],
  ["treatment_combo_zones", "zone_id", "depilation_zones", "id"],
  ["treatment_professionals", "treatment_id", "treatments", "id"],
  ["treatment_professionals", "professional_id", "professionals", "id"],
  ["professional_specialties", "professional_id", "professionals", "id"],
  ["professional_specialties", "specialty_id", "specialties", "id"],
  ["treatment_combo_extras", "treatment_id", "treatments", "id"],
];

const brokenReferences: Array<Record<string, unknown>> = [];
for (const [sourceTable, sourceColumn, targetTable] of references) {
  const targetIds = ids(targetTable);
  for (const row of dataByTable[sourceTable] ?? []) {
    const value = row[sourceColumn];
    if (value !== null && value !== undefined && typeof value === "string" && !targetIds.has(value)) {
      brokenReferences.push({ sourceTable, sourceColumn, targetTable, sourceId: row.id ?? null, missingId: value });
    }
  }
}

const schemaManifest = readdirSync(schemaRoot)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => {
    const content = readFileSync(join(schemaRoot, file));
    const parsed = JSON.parse(content.toString("utf8")) as unknown[];
    return { file: `schema/${file}`, objects: parsed.length, bytes: content.length, sha256: sha256(content) };
  });

const verification = {
  captured_at: new Date().toISOString(),
  tables: manifest.length,
  source_rows: Object.values(sourceCounts).reduce((sum, count) => sum + count, 0),
  file_rows: Object.values(dataByTable).reduce((sum, rows) => sum + rows.length, 0),
  count_mismatches: countMismatches,
  broken_references: brokenReferences,
  schema_groups: schemaManifest.length,
  schema_objects: schemaManifest.reduce((sum, item) => sum + item.objects, 0),
};

writeFileSync(join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
writeFileSync(join(root, "source-counts.json"), `${JSON.stringify(sourceCounts, null, 2)}\n`, "utf8");
writeFileSync(join(root, "schema-snapshot-manifest.json"), `${JSON.stringify(schemaManifest, null, 2)}\n`, "utf8");
writeFileSync(join(root, "backup-verification.json"), `${JSON.stringify(verification, null, 2)}\n`, "utf8");

if (countMismatches.length > 0 || brokenReferences.length > 0) process.exitCode = 1;
console.log(JSON.stringify(verification));
