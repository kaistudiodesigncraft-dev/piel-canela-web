import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1).replace(/^['"]|['"]$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase public environment is not configured");

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function query(table, columns, order = "id") {
  const result = await supabase.from(table).select(columns).order(order);
  return result.error
    ? { rows: [], error: result.error.code }
    : { rows: result.data ?? [], error: null };
}

const [treatments, categories, specialties, professionals, specials] = await Promise.all([
  query("treatments", "id,slug,specialty_id,is_active,updated_at", "slug"),
  query("treatment_categories", "id,slug,is_active,updated_at", "slug"),
  query("specialties", "id,slug,is_active,updated_at", "slug"),
  query("professionals", "id,specialty_id,is_active,updated_at"),
  query("monthly_specials", "id,treatment_id,is_active,updated_at"),
]);

const inventory = {
  capturedAt: new Date().toISOString(),
  scope: "public-rls-sanitized",
  projectRef: new URL(url).hostname.split(".")[0],
  warning: "No incluye clientes, reservas, notas, correos, teléfonos ni objetos privados de Storage.",
  counts: {
    visibleTreatments: treatments.error ? null : treatments.rows.length,
    visibleCategories: categories.error ? null : categories.rows.length,
    visibleSpecialties: specialties.error ? null : specialties.rows.length,
    visibleProfessionals: professionals.error ? null : professionals.rows.length,
    visibleMonthlySpecials: specials.error ? null : specials.rows.length,
  },
  restrictedQueries: Object.fromEntries(
    Object.entries({ treatments, categories, specialties, professionals, monthlySpecials: specials })
      .filter(([, result]) => result.error)
      .map(([name, result]) => [name, result.error]),
  ),
  treatments: treatments.rows,
  categories: categories.rows,
  specialties: specialties.rows,
  professionals: professionals.rows,
  monthlySpecials: specials.rows,
};

const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
if (process.argv.includes("--write")) {
  fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1")), "public-inventory.json"), serialized);
} else {
  process.stdout.write(serialized);
}
