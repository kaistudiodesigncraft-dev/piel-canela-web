import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };
type Row = Record<string, JsonValue>;

interface TableBaseline {
  count: number;
  sha256: string;
  rows: Record<string, string>;
}

interface SchemaBaseline {
  count: number;
  sha256: string;
  objects: Record<string, string>;
}

interface BaselineV2 {
  schemaVersion: 2;
  capturedAt: string;
  source: {
    projectRef: string;
    mode: "production-read-only-select-export";
  };
  tables: Record<string, TableBaseline>;
  schema: Record<string, SchemaBaseline>;
}

interface Difference {
  scope: "data" | "schema";
  group: string;
  classification: "igual" | "agregado" | "modificado" | "eliminado";
  detail: string;
  blocking: boolean;
}

interface ContractActivityDifference {
  category: "deriva-contrato" | "actividad-cliente";
  scope: "data" | "schema";
  group: string;
  classification: "agregado" | "modificado" | "eliminado";
  detail: string;
  observedAt: string | null;
  blocking: boolean;
}

interface LocalRestoreDifference {
  scope: "data" | "schema";
  group: string;
  classification: "agregado" | "modificado" | "eliminado" | "excepcion-entorno";
  detail: string;
  blocking: boolean;
}

const AUTOMATIC_COLUMNS = new Set(["created_at", "updated_at"]);
const DEPILATION_TREATMENT_ID = "a1f1196c-ff98-4a7b-86d6-355d3273944b";
const CONTRACT_SCHEMA_GROUPS = new Set(["policies", "functions", "function_grants", "constraints", "triggers"]);
const SENSITIVE_ACTIVITY_TABLES = new Set([
  "bookings",
  "booking_status_history",
  "booking_whatsapp_consents",
  "customers",
  "customer_packages",
  "package_redemptions",
  "whatsapp_delivery_events",
  "whatsapp_outbox",
]);
const LOCAL_PLATFORM_SCHEMA_EXCEPTIONS = new Set([
  "functions:public.rls_auto_enable()",
]);

const COMPOSITE_KEYS: Record<string, string[]> = {
  booking_whatsapp_consents: ["booking_id"],
  business_settings: ["singleton"],
  professional_specialties: ["professional_id", "specialty_id"],
  site_content: ["key"],
  site_content_drafts: ["key"],
  treatment_combo_allowed_extras: ["combo_id", "extra_id"],
  treatment_combo_zones: ["combo_id", "zone_id"],
  treatment_professionals: ["treatment_id", "professional_id"],
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stable(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key]!)]),
    );
  }
  return value;
}

function canonical(value: JsonValue): string {
  return JSON.stringify(stable(value));
}

function withoutAutomaticColumns(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !AUTOMATIC_COLUMNS.has(key)),
  );
}

function identityFor(table: string, row: Row): string | null {
  if (typeof row.id === "string" || typeof row.id === "number") return String(row.id);
  const fields = COMPOSITE_KEYS[table];
  if (!fields) return null;
  return fields.map((field) => String(row[field] ?? "null")).join("::");
}

function fingerprintRows(table: string, rows: Row[]): TableBaseline {
  const identified = rows.map((row) => {
    const value = withoutAutomaticColumns(row);
    return { identity: identityFor(table, row), value, hash: sha256(canonical(value)) };
  });
  const duplicateCounts = new Map<string, number>();
  const normalized = identified.map((item) => {
    if (item.identity !== null) return { key: item.identity, value: item.value, hash: item.hash };
    const seen = (duplicateCounts.get(item.hash) ?? 0) + 1;
    duplicateCounts.set(item.hash, seen);
    return { key: `${item.hash}#${seen}`, value: item.value, hash: item.hash };
  }).sort((left, right) => left.key.localeCompare(right.key));
  return {
    count: rows.length,
    sha256: sha256(canonical(normalized.map(({ key, value }) => ({ key, value })) as unknown as JsonValue)),
    rows: Object.fromEntries(normalized.map(({ key, hash }) => [key, hash])),
  };
}

function readJsonArray(path: string): Row[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${path} no contiene un arreglo JSON.`);
  return parsed as Row[];
}

function readSnapshotGroup(directory: string): Record<string, Row[]> {
  if (!existsSync(directory)) throw new Error(`No existe el directorio: ${directory}`);
  return Object.fromEntries(
    readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => [basename(file, ".json"), readJsonArray(join(directory, file))]),
  );
}

function snapshotData(snapshotDirectory: string): Record<string, Row[]> {
  return readSnapshotGroup(join(snapshotDirectory, "data"));
}

function snapshotSchema(snapshotDirectory: string): Record<string, Row[]> {
  return readSnapshotGroup(join(snapshotDirectory, "schema"));
}

function rowsByIdentity(table: string, rows: Row[]): Map<string, Row> {
  const result = new Map<string, Row>();
  const duplicateCounts = new Map<string, number>();
  for (const row of rows) {
    const clean = withoutAutomaticColumns(row);
    const directIdentity = identityFor(table, row);
    if (directIdentity !== null) {
      result.set(directIdentity, row);
      continue;
    }
    const hash = sha256(canonical(clean));
    const seen = (duplicateCounts.get(hash) ?? 0) + 1;
    duplicateCounts.set(hash, seen);
    result.set(`${hash}#${seen}`, row);
  }
  return result;
}

function schemaByIdentity(rows: Row[]): Map<string, Row> {
  const result = new Map<string, Row>();
  for (const row of rows) {
    const key = row.object_key ?? (
      typeof row.table_name === "string" && typeof row.column_name === "string"
        ? `${row.table_name}.${row.column_name}`
        : null
    );
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("Un objeto de esquema no tiene object_key válido.");
    }
    result.set(key, row);
  }
  return result;
}

function activityTimestamp(row: Row | undefined): string | null {
  if (!row) return null;
  for (const field of ["updated_at", "created_at", "status_changed_at"]) {
    if (typeof row[field] === "string") return row[field] as string;
  }
  return null;
}

function changedFields(before: Row, after: Row): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => !AUTOMATIC_COLUMNS.has(key))
    .filter((key) => canonical((before[key] ?? null) as JsonValue) !== canonical((after[key] ?? null) as JsonValue))
    .sort();
}

function safeActivityIdentity(table: string, identity: string): string {
  return SENSITIVE_ACTIVITY_TABLES.has(table)
    ? `ref:${sha256(identity).slice(0, 12)}`
    : identity;
}

function normalizeSchemaValue(group: string, value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map((item) => normalizeSchemaValue(group, item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeSchemaValue(group, item)]));
  }
  if (typeof value !== "string") return value;
  let normalized = value.replaceAll("\r\n", "\n");
  if (group === "columns") normalized = normalized.replaceAll("extensions.gen_random_bytes", "gen_random_bytes");
  return normalized;
}

function compareLocalRestore(referenceDirectory: string, currentDirectory: string): LocalRestoreDifference[] {
  const referenceData = snapshotData(referenceDirectory);
  const currentData = snapshotData(currentDirectory);
  const referenceSchema = snapshotSchema(referenceDirectory);
  const currentSchema = snapshotSchema(currentDirectory);
  const result: LocalRestoreDifference[] = [];

  for (const table of new Set([...Object.keys(referenceData), ...Object.keys(currentData)])) {
    const before = fingerprintRows(table, referenceData[table] ?? []);
    const after = fingerprintRows(table, currentData[table] ?? []);
    for (const difference of compareFingerprints("data", table, before.rows, after.rows)) {
      if (difference.classification === "igual") continue;
      result.push({ ...difference, classification: difference.classification as LocalRestoreDifference["classification"] });
    }
  }

  for (const group of new Set([...Object.keys(referenceSchema), ...Object.keys(currentSchema)])) {
    const before = schemaByIdentity(referenceSchema[group] ?? []);
    const after = schemaByIdentity(currentSchema[group] ?? []);
    const unavailableProductionGrantInventory = group === "table_grants" && before.size === 0;
    for (const [identity, row] of before) {
      const currentRow = after.get(identity);
      const exceptionKey = `${group}:${identity}`;
      if (!currentRow) {
        const environmentException = LOCAL_PLATFORM_SCHEMA_EXCEPTIONS.has(exceptionKey);
        result.push({
          scope: "schema",
          group,
          classification: environmentException ? "excepcion-entorno" : "eliminado",
          detail: identity,
          blocking: !environmentException,
        });
        continue;
      }
      const left = canonical(normalizeSchemaValue(group, row as JsonValue));
      const right = canonical(normalizeSchemaValue(group, currentRow as JsonValue));
      if (left !== right) result.push({ scope: "schema", group, classification: "modificado", detail: identity, blocking: true });
    }
    for (const identity of after.keys()) {
      if (!before.has(identity)) {
        result.push({
          scope: "schema",
          group,
          classification: unavailableProductionGrantInventory ? "excepcion-entorno" : "agregado",
          detail: identity,
          blocking: !unavailableProductionGrantInventory,
        });
      }
    }
  }
  return result;
}

function compareSchemaWatch(referenceDirectory: string, currentDirectory: string): Difference[] {
  const referenceSchema = snapshotSchema(referenceDirectory);
  const currentSchema = snapshotSchema(currentDirectory);
  const groups = new Set([...Object.keys(referenceSchema), ...Object.keys(currentSchema)]);
  const result: Difference[] = [];

  for (const group of groups) {
    const before = schemaByIdentity(referenceSchema[group] ?? []);
    const after = schemaByIdentity(currentSchema[group] ?? []);
    for (const [identity, row] of before) {
      const currentRow = after.get(identity);
      if (!currentRow) {
        result.push({ scope: "schema", group, classification: "eliminado", detail: identity, blocking: true });
      } else if (canonical(row as JsonValue) !== canonical(currentRow as JsonValue)) {
        result.push({ scope: "schema", group, classification: "modificado", detail: identity, blocking: true });
      }
    }
    for (const identity of after.keys()) {
      if (!before.has(identity)) {
        result.push({ scope: "schema", group, classification: "agregado", detail: identity, blocking: true });
      }
    }
  }
  return result;
}

function protectedDepilationIdentities(reference: Record<string, Row[]>) {
  const zoneIds = new Set((reference.depilation_zones ?? [])
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string"));
  const comboIds = new Set((reference.treatment_combos ?? [])
    .filter((row) => row.treatment_id === DEPILATION_TREATMENT_ID)
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string"));
  const relationIds = new Set((reference.treatment_combo_zones ?? [])
    .filter((row) => typeof row.combo_id === "string" && comboIds.has(row.combo_id))
    .map((row) => `${String(row.combo_id)}::${String(row.zone_id)}`));
  return { zoneIds, comboIds, relationIds };
}

function compareContractAndActivity(
  referenceDirectory: string,
  currentDirectory: string,
): ContractActivityDifference[] {
  const referenceData = snapshotData(referenceDirectory);
  const currentData = snapshotData(currentDirectory);
  const referenceSchema = snapshotSchema(referenceDirectory);
  const currentSchema = snapshotSchema(currentDirectory);
  const protectedIds = protectedDepilationIdentities(referenceData);
  const result: ContractActivityDifference[] = [];

  for (const group of CONTRACT_SCHEMA_GROUPS) {
    const before = schemaByIdentity(referenceSchema[group] ?? []);
    const after = schemaByIdentity(currentSchema[group] ?? []);
    for (const [identity, row] of before) {
      const currentRow = after.get(identity);
      if (!currentRow) {
        result.push({ category: "deriva-contrato", scope: "schema", group, classification: "eliminado", detail: identity, observedAt: null, blocking: true });
      } else if (canonical(row as JsonValue) !== canonical(currentRow as JsonValue)) {
        result.push({ category: "deriva-contrato", scope: "schema", group, classification: "modificado", detail: identity, observedAt: null, blocking: true });
      }
    }
    for (const identity of after.keys()) {
      if (!before.has(identity)) {
        result.push({ category: "actividad-cliente", scope: "schema", group, classification: "agregado", detail: identity, observedAt: null, blocking: false });
      }
    }
  }

  for (const table of new Set([...Object.keys(referenceData), ...Object.keys(currentData)])) {
    const before = rowsByIdentity(table, referenceData[table] ?? []);
    const after = rowsByIdentity(table, currentData[table] ?? []);
    for (const [identity, row] of before) {
      const currentRow = after.get(identity);
      const protectedDeletion =
        (table === "treatments" && identity === DEPILATION_TREATMENT_ID) ||
        (table === "depilation_zones" && protectedIds.zoneIds.has(identity)) ||
        (table === "treatment_combos" && protectedIds.comboIds.has(identity)) ||
        (table === "treatment_combo_zones" && protectedIds.relationIds.has(identity));
      if (!currentRow) {
        result.push({
          category: protectedDeletion ? "deriva-contrato" : "actividad-cliente",
          scope: "data",
          group: table,
          classification: "eliminado",
          detail: safeActivityIdentity(table, identity),
          observedAt: activityTimestamp(row),
          blocking: protectedDeletion,
        });
        continue;
      }
      const fields = changedFields(row, currentRow);
      if (fields.length > 0) {
        result.push({
          category: "actividad-cliente",
          scope: "data",
          group: table,
          classification: "modificado",
          detail: `${safeActivityIdentity(table, identity)}; campos=${fields.join(",")}`,
          observedAt: activityTimestamp(currentRow),
          blocking: false,
        });
      }
    }
    for (const [identity, row] of after) {
      if (!before.has(identity)) {
        result.push({
          category: "actividad-cliente",
          scope: "data",
          group: table,
          classification: "agregado",
          detail: safeActivityIdentity(table, identity),
          observedAt: activityTimestamp(row),
          blocking: false,
        });
      }
    }
  }
  return result;
}

function fingerprintSchema(rows: Row[]): SchemaBaseline {
  const objects = rows.map((row) => {
    const key = row.object_key ?? (
      typeof row.table_name === "string" && typeof row.column_name === "string"
        ? `${row.table_name}.${row.column_name}`
        : null
    );
    if (typeof key !== "string" || key.length === 0) {
      throw new Error("Un objeto de esquema no tiene object_key válido.");
    }
    return { key, hash: sha256(canonical(row)) };
  }).sort((left, right) => left.key.localeCompare(right.key));
  return {
    count: objects.length,
    sha256: sha256(canonical(objects as unknown as JsonValue)),
    objects: Object.fromEntries(objects.map(({ key, hash }) => [key, hash])),
  };
}

function buildBaseline(snapshotDirectory: string): BaselineV2 {
  const data = readSnapshotGroup(join(snapshotDirectory, "data"));
  const schema = readSnapshotGroup(join(snapshotDirectory, "schema"));
  return {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    source: { projectRef: "dlrdlwjighvcyhirwgfu", mode: "production-read-only-select-export" },
    tables: Object.fromEntries(
      Object.entries(data).map(([table, rows]) => [table, fingerprintRows(table, rows)]),
    ),
    schema: Object.fromEntries(
      Object.entries(schema).map(([group, rows]) => [group, fingerprintSchema(rows)]),
    ),
  };
}

function compareFingerprints(
  scope: Difference["scope"],
  group: string,
  expected: Record<string, string>,
  actual: Record<string, string>,
): Difference[] {
  const result: Difference[] = [];
  for (const [key, hash] of Object.entries(expected)) {
    if (!(key in actual)) {
      result.push({ scope, group, classification: "eliminado", detail: key, blocking: true });
    } else if (actual[key] !== hash) {
      result.push({ scope, group, classification: "modificado", detail: key, blocking: true });
    }
  }
  for (const key of Object.keys(actual)) {
    if (!(key in expected)) {
      result.push({ scope, group, classification: "agregado", detail: key, blocking: false });
    }
  }
  if (result.length === 0) {
    result.push({ scope, group, classification: "igual", detail: "Huella idéntica.", blocking: false });
  }
  return result;
}

function compare(baseline: BaselineV2, current: BaselineV2): Difference[] {
  const result: Difference[] = [];
  for (const [table, expected] of Object.entries(baseline.tables)) {
    const actual = current.tables[table];
    if (!actual) {
      result.push({ scope: "data", group: table, classification: "eliminado", detail: "Tabla ausente.", blocking: true });
      continue;
    }
    result.push(...compareFingerprints("data", table, expected.rows, actual.rows));
  }
  for (const table of Object.keys(current.tables)) {
    if (!(table in baseline.tables)) {
      result.push({ scope: "data", group: table, classification: "agregado", detail: "Tabla nueva.", blocking: false });
    }
  }
  for (const [group, expected] of Object.entries(baseline.schema)) {
    const actual = current.schema[group];
    if (!actual) {
      result.push({ scope: "schema", group, classification: "eliminado", detail: "Grupo de esquema ausente.", blocking: true });
      continue;
    }
    result.push(...compareFingerprints("schema", group, expected.objects, actual.objects));
  }
  for (const group of Object.keys(current.schema)) {
    if (!(group in baseline.schema)) {
      result.push({ scope: "schema", group, classification: "agregado", detail: "Grupo de esquema nuevo.", blocking: false });
    }
  }
  return result;
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const snapshotDirectory = resolve(argument("--snapshot") ?? "");
if (!argument("--snapshot")) throw new Error("Use --snapshot <directorio>.");
const current = buildBaseline(snapshotDirectory);

if (argument("--mode") === "schema-watch") {
  const referenceArgument = argument("--reference-snapshot");
  if (!referenceArgument) throw new Error("El modo schema-watch requiere --reference-snapshot <directorio>.");
  const referenceDirectory = resolve(referenceArgument);
  const differences = compareSchemaWatch(referenceDirectory, snapshotDirectory);
  console.log(`Referencia de esquema autorizada: ${referenceDirectory}`);
  console.log(`Snapshot observado: ${snapshotDirectory}`);
  console.log(`Diferencias nuevas de esquema: ${differences.length}`);
  for (const difference of differences) {
    console.log(`[ALERTA][${difference.classification.toUpperCase()}] ${difference.group}: ${difference.detail}`);
  }
  process.exitCode = differences.length > 0 ? 1 : 0;
  process.exit();
}

if (argument("--mode") === "contract-activity") {
  const referenceArgument = argument("--reference-snapshot");
  if (!referenceArgument) throw new Error("El modo contract-activity requiere --reference-snapshot <directorio>.");
  const referenceDirectory = resolve(referenceArgument);
  const differences = compareContractAndActivity(referenceDirectory, snapshotDirectory);
  const blockers = differences.filter((item) => item.blocking);
  const activity = differences.filter((item) => item.category === "actividad-cliente");
  console.log(`Referencia contractual: ${referenceDirectory}`);
  console.log(`Snapshot actual: ${snapshotDirectory}`);
  console.log(`Deriva bloqueante: ${blockers.length}; actividad informativa: ${activity.length}`);
  for (const difference of differences) {
    const date = difference.observedAt ? `; fecha=${difference.observedAt}` : "";
    console.log(`[${difference.category.toUpperCase()}][${difference.classification.toUpperCase()}] ${difference.group}: ${difference.detail}${date}`);
  }
  process.exitCode = blockers.length > 0 ? 1 : 0;
  process.exit();
}

if (argument("--mode") === "local-restore") {
  const referenceArgument = argument("--reference-snapshot");
  if (!referenceArgument) throw new Error("El modo local-restore requiere --reference-snapshot <directorio>.");
  const referenceDirectory = resolve(referenceArgument);
  const differences = compareLocalRestore(referenceDirectory, snapshotDirectory);
  const blockers = differences.filter((item) => item.blocking);
  const exceptions = differences.filter((item) => item.classification === "excepcion-entorno");
  console.log(`Referencia de producción: ${referenceDirectory}`);
  console.log(`Restauración local: ${snapshotDirectory}`);
  console.log(`Diferencias bloqueantes: ${blockers.length}; excepciones de entorno conocidas: ${exceptions.length}`);
  for (const difference of differences) {
    console.log(`[${difference.classification.toUpperCase()}] ${difference.scope}/${difference.group}: ${difference.detail}`);
  }
  process.exitCode = blockers.length > 0 ? 1 : 0;
  process.exit();
}

if (process.argv.includes("--generate")) {
  const output = resolve(argument("--output") ?? "docs/sprint-1/baseline-v2.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  console.log(`Baseline v2 generado: ${output}`);
  console.log(`Tablas: ${Object.keys(current.tables).length}; grupos de esquema: ${Object.keys(current.schema).length}`);
  process.exit(0);
}

const baselinePath = resolve(argument("--baseline") ?? "docs/sprint-1/baseline-v2.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as BaselineV2;
const differences = compare(baseline, current);
const changed = differences.filter((item) => item.classification !== "igual");
const blocking = differences.filter((item) => item.blocking);

console.log(`Baseline v2: ${baselinePath}`);
console.log(`Datos: ${Object.keys(baseline.tables).length} tablas; esquema: ${Object.keys(baseline.schema).length} grupos.`);
console.log(`Diferencias: ${changed.length}; bloqueantes: ${blocking.length}`);
for (const difference of changed) {
  console.log(`[${difference.scope.toUpperCase()}][${difference.classification.toUpperCase()}] ${difference.group}: ${difference.detail}`);
}
process.exitCode = blocking.length > 0 ? 1 : 0;
