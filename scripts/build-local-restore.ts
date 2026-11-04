import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

type JsonRow = Record<string, unknown>;

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function dollarTag(table: string, payload: string) {
  let suffix = 0;
  while (true) {
    const tag = `$pc_${table.replaceAll(/[^a-z0-9_]/gi, "_")}_${suffix}$`;
    if (!payload.includes(tag)) return tag;
    suffix += 1;
  }
}

const backupDirectoryArgument = argument("--backup");
if (!backupDirectoryArgument) throw new Error("Use --backup <directorio>.");
const backupDirectory = resolve(backupDirectoryArgument);
const dataDirectory = join(backupDirectory, "data");
if (!existsSync(dataDirectory)) throw new Error(`No existe ${dataDirectory}.`);
const functionsPath = join(backupDirectory, "schema", "functions.json");
const functionGrantsPath = join(backupDirectory, "schema", "function_grants.json");
const tableGrantsPath = join(backupDirectory, "schema", "table_grants.json");
const columnGrantsPath = join(backupDirectory, "schema", "column_grants.json");

const tableFiles = readdirSync(dataDirectory).filter((file) => file.endsWith(".json")).sort();
const tables = tableFiles.map((file) => basename(file, ".json"));
const localTarget = "supabase_db_g-p-6a6934b02b088191b6e747e7bf181ed3";
const statements: string[] = [
  "\\set ON_ERROR_STOP on",
  "\\if :{?LOCAL_RESTORE_CONFIRMED}",
  "\\else",
  "  \\echo 'Abortado: use -v LOCAL_RESTORE_CONFIRMED=1 solo contra Supabase local aislado.'",
  "  \\quit",
  "\\endif",
  "\\if :{?LOCAL_RESTORE_TARGET}",
  "\\else",
  "  \\echo 'Abortado: falta -v LOCAL_RESTORE_TARGET=<contenedor local esperado>.'",
  "  \\quit",
  "\\endif",
  "begin;",
  "select set_config('pc.local_restore_target', :'LOCAL_RESTORE_TARGET', false);",
  "do $guard$",
  "begin",
  `  if current_setting('pc.local_restore_target', true) <> '${localTarget}' then`,
  "    raise exception 'Restauración rechazada: destino local no reconocido.';",
  "  end if;",
  "end;",
  "$guard$;",
  "set constraints all deferred;",
  "set session_replication_role = replica;",
];

for (const file of tableFiles) {
  const table = basename(file, ".json");
  const payload = readFileSync(join(dataDirectory, file), "utf8").trim();
  const rows = JSON.parse(payload) as JsonRow[];
  statements.push(`-- ${table}: ${rows.length} filas`);
  if (rows.length === 0) continue;
  const columns = Object.keys(rows[0]!);
  if (columns.length === 0) throw new Error(`${table} contiene una fila sin columnas.`);
  for (const row of rows) {
    const keys = Object.keys(row);
    if (keys.length !== columns.length || keys.some((key) => !columns.includes(key))) {
      throw new Error(`${table} no conserva una estructura de columnas uniforme.`);
    }
  }
  const tag = dollarTag(table, payload);
  const quotedColumns = columns.map(quoteIdentifier).join(", ");
  statements.push(
    `insert into public.${quoteIdentifier(table)} (${quotedColumns})`,
    "overriding system value",
    `select ${quotedColumns}`,
    `from jsonb_populate_recordset(null::public.${quoteIdentifier(table)}, ${tag}${payload}${tag});`,
  );
}

statements.push("set session_replication_role = origin;", "commit;", "");
const restoreSql = statements.join("\n");
const restorePath = join(backupDirectory, "restore-data.sql");
writeFileSync(restorePath, restoreSql, "utf8");

const clearSql = [
  "\\set ON_ERROR_STOP on",
  "\\if :{?LOCAL_RESTORE_CONFIRMED}",
  "\\else",
  "  \\echo 'Abortado: use -v LOCAL_RESTORE_CONFIRMED=1 solo contra Supabase local aislado.'",
  "  \\quit",
  "\\endif",
  "\\if :{?LOCAL_RESTORE_TARGET}",
  "\\else",
  "  \\echo 'Abortado: falta -v LOCAL_RESTORE_TARGET=<contenedor local esperado>.'",
  "  \\quit",
  "\\endif",
  "begin;",
  "select set_config('pc.local_restore_target', :'LOCAL_RESTORE_TARGET', false);",
  "do $guard$",
  "begin",
  `  if current_setting('pc.local_restore_target', true) <> '${localTarget}' then`,
  "    raise exception 'Limpieza rechazada: destino local no reconocido.';",
  "  end if;",
  "end;",
  "$guard$;",
  `truncate table ${tables.map((table) => `public.${quoteIdentifier(table)}`).join(", ")} restart identity cascade;`,
  "commit;",
  "",
].join("\n");
writeFileSync(join(backupDirectory, "clear-local-data.sql"), clearSql, "utf8");

let functionsSql: string | null = null;
if (existsSync(functionsPath)) {
  const functionRows = JSON.parse(readFileSync(functionsPath, "utf8")) as JsonRow[];
  const definitions = functionRows.map((row, index) => {
    if (typeof row.definition !== "string" || row.definition.trim().length === 0) {
      throw new Error(`La función ${index + 1} no contiene una definición restaurable.`);
    }
    return row.definition.trimEnd();
  });
  functionsSql = [
    "\\set ON_ERROR_STOP on",
    "\\if :{?LOCAL_RESTORE_CONFIRMED}",
    "\\else",
    "  \\echo 'Abortado: use -v LOCAL_RESTORE_CONFIRMED=1 solo contra Supabase local aislado.'",
    "  \\quit",
    "\\endif",
    "\\if :{?LOCAL_RESTORE_TARGET}",
    "\\else",
    "  \\echo 'Abortado: falta -v LOCAL_RESTORE_TARGET=<contenedor local esperado>.'",
    "  \\quit",
    "\\endif",
    "begin;",
    "select set_config('pc.local_restore_target', :'LOCAL_RESTORE_TARGET', false);",
    "do $guard$",
    "begin",
    `  if current_setting('pc.local_restore_target', true) <> '${localTarget}' then`,
    "    raise exception 'Restauración de funciones rechazada: destino local no reconocido.';",
    "  end if;",
    "end;",
    "$guard$;",
    ...definitions.map((definition) => `${definition};`),
    "commit;",
    "",
  ].join("\n");
  writeFileSync(join(backupDirectory, "restore-functions.sql"), functionsSql, "utf8");
}

let functionGrantsSql: string | null = null;
if (existsSync(functionGrantsPath)) {
  const grantRows = JSON.parse(readFileSync(functionGrantsPath, "utf8")) as JsonRow[];
  const functionKeys = [...new Set(grantRows.map((row, index) => {
    if (typeof row.function_key !== "string" || row.function_key.trim().length === 0) {
      throw new Error(`El grant de función ${index + 1} no contiene function_key.`);
    }
    return row.function_key;
  }))].sort();
  const grantStatements = grantRows.map((row, index) => {
    if (typeof row.function_key !== "string" || typeof row.grantee !== "string") {
      throw new Error(`El grant de función ${index + 1} está incompleto.`);
    }
    if (row.privilege_type !== "EXECUTE") {
      throw new Error(`Privilegio de función no soportado: ${String(row.privilege_type)}.`);
    }
    const grantee = row.grantee === "PUBLIC" ? "PUBLIC" : quoteIdentifier(row.grantee);
    const grantOption = row.is_grantable === true ? " with grant option" : "";
    return `grant execute on function ${row.function_key} to ${grantee}${grantOption};`;
  });
  functionGrantsSql = [
    "\\set ON_ERROR_STOP on",
    "\\if :{?LOCAL_RESTORE_CONFIRMED}",
    "\\else",
    "  \\echo 'Abortado: use -v LOCAL_RESTORE_CONFIRMED=1 solo contra Supabase local aislado.'",
    "  \\quit",
    "\\endif",
    "\\if :{?LOCAL_RESTORE_TARGET}",
    "\\else",
    "  \\echo 'Abortado: falta -v LOCAL_RESTORE_TARGET=<contenedor local esperado>.'",
    "  \\quit",
    "\\endif",
    "begin;",
    "select set_config('pc.local_restore_target', :'LOCAL_RESTORE_TARGET', false);",
    "do $guard$",
    "begin",
    `  if current_setting('pc.local_restore_target', true) <> '${localTarget}' then`,
    "    raise exception 'Restauración de grants rechazada: destino local no reconocido.';",
    "  end if;",
    "end;",
    "$guard$;",
    ...functionKeys.map((functionKey) =>
      `revoke all privileges on function ${functionKey} from PUBLIC, anon, authenticated, service_role;`,
    ),
    ...grantStatements,
    "commit;",
    "",
  ].join("\n");
  writeFileSync(join(backupDirectory, "restore-function-grants.sql"), functionGrantsSql, "utf8");
}

let tableGrantsSql: string | null = null;
if (existsSync(tableGrantsPath)) {
  const grantRows = JSON.parse(readFileSync(tableGrantsPath, "utf8")) as JsonRow[];
  const relationKeys = [...new Set(grantRows.map((row, index) => {
    if (typeof row.schema_name !== "string" || typeof row.table_name !== "string") {
      throw new Error(`El grant de tabla ${index + 1} no contiene relación.`);
    }
    return `${quoteIdentifier(row.schema_name)}.${quoteIdentifier(row.table_name)}`;
  }))].sort();
  const grantStatements = grantRows.map((row, index) => {
    if (
      typeof row.schema_name !== "string" ||
      typeof row.table_name !== "string" ||
      typeof row.grantee !== "string" ||
      typeof row.privilege_type !== "string"
    ) {
      throw new Error(`El grant de tabla ${index + 1} está incompleto.`);
    }
    const allowed = new Set([
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "TRUNCATE",
      "REFERENCES",
      "TRIGGER",
      "MAINTAIN",
    ]);
    if (!allowed.has(row.privilege_type)) {
      throw new Error(`Privilegio de tabla no soportado: ${row.privilege_type}.`);
    }
    const relation = `${quoteIdentifier(row.schema_name)}.${quoteIdentifier(row.table_name)}`;
    const grantee = row.grantee === "PUBLIC" ? "PUBLIC" : quoteIdentifier(row.grantee);
    const grantOption = row.is_grantable === true ? " with grant option" : "";
    return `grant ${row.privilege_type.toLowerCase()} on table ${relation} to ${grantee}${grantOption};`;
  });
  tableGrantsSql = [
    "\\set ON_ERROR_STOP on",
    "\\if :{?LOCAL_RESTORE_CONFIRMED}",
    "\\else",
    "  \\echo 'Abortado: use -v LOCAL_RESTORE_CONFIRMED=1 solo contra Supabase local aislado.'",
    "  \\quit",
    "\\endif",
    "\\if :{?LOCAL_RESTORE_TARGET}",
    "\\else",
    "  \\echo 'Abortado: falta -v LOCAL_RESTORE_TARGET=<contenedor local esperado>.'",
    "  \\quit",
    "\\endif",
    "begin;",
    "select set_config('pc.local_restore_target', :'LOCAL_RESTORE_TARGET', false);",
    "do $guard$",
    "begin",
    `  if current_setting('pc.local_restore_target', true) <> '${localTarget}' then`,
    "    raise exception 'Restauración de grants de tablas rechazada: destino local no reconocido.';",
    "  end if;",
    "end;",
    "$guard$;",
    ...relationKeys.map((relation) =>
      `revoke all privileges on table ${relation} from PUBLIC, anon, authenticated, service_role;`,
    ),
    ...grantStatements,
    "commit;",
    "",
  ].join("\n");
  writeFileSync(join(backupDirectory, "restore-table-grants.sql"), tableGrantsSql, "utf8");
}

let columnGrantsSql: string | null = null;
if (existsSync(columnGrantsPath)) {
  const grantRows = JSON.parse(readFileSync(columnGrantsPath, "utf8")) as JsonRow[];
  const relationColumns = new Map<string, Set<string>>();
  const relationGrantees = new Map<string, Set<string>>();
  for (const [index, row] of grantRows.entries()) {
    if (
      typeof row.schema_name !== "string" ||
      typeof row.table_name !== "string" ||
      typeof row.column_name !== "string" ||
      typeof row.grantee !== "string" ||
      typeof row.privilege_type !== "string"
    ) {
      throw new Error(`El grant de columna ${index + 1} está incompleto.`);
    }
    if (!new Set(["SELECT", "INSERT", "UPDATE", "REFERENCES"]).has(row.privilege_type)) {
      throw new Error(`Privilegio de columna no soportado: ${row.privilege_type}.`);
    }
    const relation = `${quoteIdentifier(row.schema_name)}.${quoteIdentifier(row.table_name)}`;
    relationColumns.set(relation, relationColumns.get(relation) ?? new Set());
    relationColumns.get(relation)!.add(row.column_name);
    relationGrantees.set(relation, relationGrantees.get(relation) ?? new Set());
    relationGrantees.get(relation)!.add(row.grantee);
  }
  const revokeStatements: string[] = [];
  for (const [relation, columns] of [...relationColumns.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const quotedColumns = [...columns].sort().map(quoteIdentifier).join(", ");
    const grantees = new Set(["PUBLIC", "anon", "authenticated", "service_role", ...(relationGrantees.get(relation) ?? [])]);
    for (const granteeName of [...grantees].sort()) {
      const grantee = granteeName === "PUBLIC" ? "PUBLIC" : quoteIdentifier(granteeName);
      for (const privilege of ["select", "insert", "update", "references"]) {
        revokeStatements.push(`revoke ${privilege} (${quotedColumns}) on table ${relation} from ${grantee};`);
      }
    }
  }
  const grantStatements = grantRows.map((row) => {
    const relation = `${quoteIdentifier(String(row.schema_name))}.${quoteIdentifier(String(row.table_name))}`;
    const column = quoteIdentifier(String(row.column_name));
    const grantee = row.grantee === "PUBLIC" ? "PUBLIC" : quoteIdentifier(String(row.grantee));
    const grantOption = row.is_grantable === true ? " with grant option" : "";
    return `grant ${String(row.privilege_type).toLowerCase()} (${column}) on table ${relation} to ${grantee}${grantOption};`;
  });
  columnGrantsSql = [
    "\\set ON_ERROR_STOP on",
    "\\if :{?LOCAL_RESTORE_CONFIRMED}",
    "\\else",
    "  \\echo 'Abortado: use -v LOCAL_RESTORE_CONFIRMED=1 solo contra Supabase local aislado.'",
    "  \\quit",
    "\\endif",
    "\\if :{?LOCAL_RESTORE_TARGET}",
    "\\else",
    "  \\echo 'Abortado: falta -v LOCAL_RESTORE_TARGET=<contenedor local esperado>.'",
    "  \\quit",
    "\\endif",
    "begin;",
    "select set_config('pc.local_restore_target', :'LOCAL_RESTORE_TARGET', false);",
    "do $guard$",
    "begin",
    `  if current_setting('pc.local_restore_target', true) <> '${localTarget}' then`,
    "    raise exception 'Restauración de grants de columnas rechazada: destino local no reconocido.';",
    "  end if;",
    "end;",
    "$guard$;",
    ...revokeStatements,
    ...grantStatements,
    "commit;",
    "",
  ].join("\n");
  writeFileSync(join(backupDirectory, "restore-column-grants.sql"), columnGrantsSql, "utf8");
}

const manifest = {
  generatedAt: new Date().toISOString(),
  tables: tables.length,
  restoreFile: "restore-data.sql",
  restoreSha256: createHash("sha256").update(restoreSql).digest("hex"),
  clearFile: "clear-local-data.sql",
  clearSha256: createHash("sha256").update(clearSql).digest("hex"),
  functionsFile: functionsSql ? "restore-functions.sql" : null,
  functionsSha256: functionsSql ? createHash("sha256").update(functionsSql).digest("hex") : null,
  functionGrantsFile: functionGrantsSql ? "restore-function-grants.sql" : null,
  functionGrantsSha256: functionGrantsSql
    ? createHash("sha256").update(functionGrantsSql).digest("hex")
    : null,
  tableGrantsFile: tableGrantsSql ? "restore-table-grants.sql" : null,
  tableGrantsSha256: tableGrantsSql
    ? createHash("sha256").update(tableGrantsSql).digest("hex")
    : null,
  columnGrantsFile: columnGrantsSql ? "restore-column-grants.sql" : null,
  columnGrantsSha256: columnGrantsSql
    ? createHash("sha256").update(columnGrantsSql).digest("hex")
    : null,
};
mkdirSync(backupDirectory, { recursive: true });
writeFileSync(join(backupDirectory, "restore-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify(manifest));
