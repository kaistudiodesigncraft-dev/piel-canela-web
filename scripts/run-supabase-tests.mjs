import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseExecutable = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase",
);

// These are independent pgTAP suites. The H8 concurrency files intentionally
// live outside this manifest because they require two coordinated connections;
// run them through `pnpm supabase:test:concurrency` instead.
const testFiles = [
  "admin_combo_concurrency.sql",
  "booking_deletion.sql",
  "booking_integrity.sql",
  "booking_status_transition_permissions.sql",
  "catalog_removal.sql",
  "depilation_zone_orders.sql",
  "professional_deletion.sql",
  "professional_editor_atomic.sql",
  "public_mixed_combos.sql",
  "rls_boundaries.sql",
  "universal_booking_admin_h4.sql",
  "universal_booking_public_h5.sql",
  "universal_booking_rpc_h3.sql",
  "universal_service_packages_acceptance_h10.sql",
  "universal_service_packages_admin_h9.sql",
  "universal_service_packages_h8.sql",
].map((fileName) => path.join(projectRoot, "supabase", "tests", fileName));

const result = spawnSync(supabaseExecutable, ["test", "db", ...testFiles], {
  cwd: projectRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
