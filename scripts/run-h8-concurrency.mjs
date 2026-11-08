import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const containerName = "supabase_db_g-p-6a6934b02b088191b6e747e7bf181ed3";

async function executeSql(relativePath) {
  const sql = await readFile(path.join(projectRoot, relativePath), "utf8");
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      ["exec", "-i", containerName, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
      { cwd: projectRoot, stdio: ["pipe", "inherit", "inherit"] },
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${relativePath} exited with code ${code ?? "unknown"}`));
    });
    child.stdin.end(sql);
  });
}

const setup = "supabase/tests/h8_concurrency_setup.sql";
const workerA = "supabase/tests/h8_concurrency_worker_a.sql";
const workerB = "supabase/tests/h8_concurrency_worker_b.sql";
const verifyAndCleanup = "supabase/tests/h8_concurrency_verify_cleanup.sql";
const cleanup = "supabase/tests/h8_concurrency_cleanup.sql";

let setupCompleted = false;
try {
  await executeSql(setup);
  setupCompleted = true;
  await Promise.all([executeSql(workerA), executeSql(workerB)]);
  await executeSql(verifyAndCleanup);
  setupCompleted = false;
} catch (error) {
  if (setupCompleted) {
    try {
      await executeSql(cleanup);
    } catch (cleanupError) {
      console.error("Concurrency cleanup also failed:", cleanupError);
    }
  }
  throw error;
}
