import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };
type Row = Record<string, JsonValue>;
type Fingerprints = Record<string, Record<string, string>>;

interface TableSummary {
  count: number;
  sha256: string;
}

interface Baseline {
  tableSummary: Record<string, TableSummary>;
  fingerprints: Fingerprints;
}

interface Difference {
  table: string;
  classification: "igual" | "agregado" | "modificado" | "eliminado";
  detail: string;
  blocking: boolean;
}

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

function withoutAutomaticTimestamps(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "created_at" && key !== "updated_at"),
  );
}

function canonical(value: JsonValue): string {
  return JSON.stringify(stable(value));
}

function rowKey(table: string, row: Row, index: number): string {
  if (typeof row.id === "string" || typeof row.id === "number") return String(row.id);
  const composites: Record<string, string[]> = {
    treatment_combo_zones: ["combo_id", "zone_id"],
    treatment_combo_allowed_extras: ["combo_id", "extra_id"],
    treatment_professionals: ["treatment_id", "professional_id"],
    professional_specialties: ["professional_id", "specialty_id"],
    booking_whatsapp_consents: ["booking_id"],
    business_settings: ["singleton"],
  };
  const fields = composites[table];
  if (fields) return fields.map((field) => String(row[field] ?? "null")).join("::");
  return `${index}::${sha256(canonical(withoutAutomaticTimestamps(row))).slice(0, 16)}`;
}

function summarize(table: string, rows: Row[]): { summary: TableSummary; fingerprints: Record<string, string> } {
  const normalized = rows.map((row, index) => ({
    key: rowKey(table, row, index),
    value: withoutAutomaticTimestamps(row),
  })).sort((left, right) => left.key.localeCompare(right.key));
  return {
    summary: { count: rows.length, sha256: sha256(canonical(normalized as unknown as JsonValue)) },
    fingerprints: Object.fromEntries(
      normalized.map(({ key, value }) => [key, sha256(canonical(value))]),
    ),
  };
}

function readSnapshot(snapshotDirectory: string): Record<string, Row[]> {
  const dataDirectory = join(snapshotDirectory, "data");
  if (!existsSync(dataDirectory)) throw new Error(`No existe el directorio de datos: ${dataDirectory}`);
  return Object.fromEntries(
    readdirSync(dataDirectory)
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const parsed = JSON.parse(readFileSync(join(dataDirectory, file), "utf8")) as unknown;
        if (!Array.isArray(parsed)) throw new Error(`${file} no contiene un arreglo JSON`);
        return [basename(file, ".json"), parsed as Row[]];
      }),
  );
}

async function readLive(tables: string[]): Promise<Record<string, Row[]>> {
  const url = process.env.SPRINT0_SUPABASE_URL;
  const serverKey = process.env.SPRINT0_SUPABASE_SERVER_KEY;
  const anonKey = process.env.SPRINT0_SUPABASE_ANON_KEY;
  const adminEmail = process.env.SPRINT0_ADMIN_EMAIL;
  const adminPassword = process.env.SPRINT0_ADMIN_PASSWORD;
  if (!url || (!serverKey && (!anonKey || !adminEmail || !adminPassword))) {
    throw new Error(
      "Falta una credencial temporal: use SPRINT0_SUPABASE_SERVER_KEY o el conjunto SPRINT0_SUPABASE_ANON_KEY, SPRINT0_ADMIN_EMAIL y SPRINT0_ADMIN_PASSWORD.",
    );
  }
  const client = createClient(url, serverKey ?? anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  if (!serverKey) {
    const auth = await client.auth.signInWithPassword({ email: adminEmail!, password: adminPassword! });
    if (auth.error) throw new Error(`No se pudo autenticar la lectura administrativa: ${auth.error.message}`);
  }
  const result: Record<string, Row[]> = {};
  for (const table of tables) {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const response = await client.from(table).select("*").range(from, from + 999);
      if (response.error) throw new Error(`${table}: ${response.error.code} ${response.error.message}`);
      const page = (response.data ?? []) as Row[];
      rows.push(...page);
      if (page.length < 1000) break;
    }
    result[table] = rows;
  }
  return result;
}

function compare(baseline: Baseline, current: Record<string, Row[]>): Difference[] {
  const differences: Difference[] = [];
  for (const [table, expected] of Object.entries(baseline.tableSummary)) {
    const rows = current[table];
    if (!rows) {
      differences.push({ table, classification: "eliminado", detail: "La tabla no está presente en la lectura actual.", blocking: true });
      continue;
    }
    const actual = summarize(table, rows);
    const expectedFingerprints = baseline.fingerprints[table];
    if (expectedFingerprints) {
      for (const [key, hash] of Object.entries(expectedFingerprints)) {
        if (!(key in actual.fingerprints)) {
          differences.push({ table, classification: "eliminado", detail: `Falta el registro ${key}.`, blocking: true });
        } else if (actual.fingerprints[key] !== hash) {
          differences.push({ table, classification: "modificado", detail: `Cambió el registro ${key}.`, blocking: true });
        }
      }
      const added = Object.keys(actual.fingerprints).filter((key) => !(key in expectedFingerprints));
      if (added.length > 0) {
        differences.push({ table, classification: "agregado", detail: `${added.length} registro(s) nuevo(s).`, blocking: false });
      }
    } else if (actual.summary.sha256 !== expected.sha256) {
      const classification = actual.summary.count < expected.count ? "eliminado"
        : actual.summary.count > expected.count ? "agregado" : "modificado";
      differences.push({
        table,
        classification,
        detail: `Conteo ${expected.count} → ${actual.summary.count}; cambió el hash de tabla.`,
        blocking: classification !== "agregado",
      });
    }
    if (actual.summary.sha256 === expected.sha256) {
      differences.push({ table, classification: "igual", detail: `${actual.summary.count} fila(s), hash idéntico.`, blocking: false });
    }
  }
  return differences;
}

const args = process.argv.slice(2);
const snapshotIndex = args.indexOf("--snapshot");
const baselineIndex = args.indexOf("--baseline");
const baselinePath = resolve(baselineIndex >= 0 ? args[baselineIndex + 1]! : "docs/sprint-0/baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;
const current = snapshotIndex >= 0
  ? readSnapshot(resolve(args[snapshotIndex + 1]!))
  : await readLive(Object.keys(baseline.tableSummary));
const differences = compare(baseline, current);
const blocking = differences.filter((item) => item.blocking);
const changed = differences.filter((item) => item.classification !== "igual");

console.log(`Baseline: ${baselinePath}`);
console.log(`Tablas verificadas: ${Object.keys(baseline.tableSummary).length}`);
console.log(`Diferencias: ${changed.length}; bloqueantes: ${blocking.length}`);
for (const item of changed) console.log(`[${item.classification.toUpperCase()}] ${item.table}: ${item.detail}`);
if (blocking.length > 0) process.exitCode = 1;
