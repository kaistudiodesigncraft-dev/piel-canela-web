export type ReleaseEnvironment = Readonly<{
  dataSource: "fixtures" | "supabase";
  releaseStage: "beta" | "live";
  isBeta: boolean;
  isProduction: boolean;
}>;

export function resolveReleaseEnvironment(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ReleaseEnvironment;

export function isBetaRelease(
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): boolean;
