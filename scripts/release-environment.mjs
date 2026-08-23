const DATA_SOURCES = new Set(["fixtures", "supabase"]);
const RELEASE_STAGES = new Set(["beta", "live"]);

function normalizedValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertValidSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Validates the small set of environment variables that decides whether a
 * deployment can expose real data. It is deliberately side-effect free so CI
 * can exercise the production contract without contacting Supabase.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function resolveReleaseEnvironment(env = process.env) {
  const dataSource = normalizedValue(env.NEXT_PUBLIC_DATA_SOURCE) || "fixtures";
  const releaseStage = normalizedValue(env.NEXT_PUBLIC_RELEASE_STAGE) || "beta";
  const vercelEnvironment = normalizedValue(env.VERCEL_ENV);
  const isProduction = vercelEnvironment === "production";

  if (!DATA_SOURCES.has(dataSource)) {
    throw new Error(
      `NEXT_PUBLIC_DATA_SOURCE debe ser "fixtures" o "supabase"; se recibió "${dataSource}".`,
    );
  }

  if (!RELEASE_STAGES.has(releaseStage)) {
    throw new Error(
      `NEXT_PUBLIC_RELEASE_STAGE debe ser "beta" o "live"; se recibió "${releaseStage}".`,
    );
  }

  if (isProduction && dataSource !== "supabase") {
    throw new Error(
      "Un despliegue de producción no puede compilar con fixtures. Configurá NEXT_PUBLIC_DATA_SOURCE=supabase.",
    );
  }

  if (dataSource === "supabase") {
    const url = normalizedValue(env.NEXT_PUBLIC_SUPABASE_URL);
    const publishableKey = normalizedValue(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    if (!assertValidSupabaseUrl(url) || publishableKey.length < 20) {
      throw new Error(
        "Supabase está seleccionado, pero faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY válidas.",
      );
    }
  }

  return Object.freeze({
    dataSource,
    releaseStage,
    isBeta: releaseStage === "beta",
    isProduction,
  });
}

export function isBetaRelease(env = process.env) {
  return resolveReleaseEnvironment(env).isBeta;
}
