import { describe, expect, it } from "vitest";
import {
  isBetaRelease,
  resolveReleaseEnvironment,
} from "../../../scripts/release-environment.mjs";

const validSupabaseEnvironment = {
  NEXT_PUBLIC_DATA_SOURCE: "supabase",
  NEXT_PUBLIC_RELEASE_STAGE: "beta",
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder_key",
};

describe("release environment", () => {
  it("defaults local and preview builds to beta fixtures", () => {
    expect(resolveReleaseEnvironment({})).toEqual({
      dataSource: "fixtures",
      releaseStage: "beta",
      isBeta: true,
      isProduction: false,
    });
  });

  it("rejects fixtures in a production deployment", () => {
    expect(() =>
      resolveReleaseEnvironment({
        NEXT_PUBLIC_DATA_SOURCE: "fixtures",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/producción no puede compilar con fixtures/i);
  });

  it("accepts a beta production deployment backed by Supabase", () => {
    expect(
      resolveReleaseEnvironment({
        ...validSupabaseEnvironment,
        VERCEL_ENV: "production",
      }),
    ).toMatchObject({
      dataSource: "supabase",
      releaseStage: "beta",
      isBeta: true,
      isProduction: true,
    });
  });

  it("rejects incomplete Supabase configuration without a network request", () => {
    expect(() =>
      resolveReleaseEnvironment({
        NEXT_PUBLIC_DATA_SOURCE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "short",
      }),
    ).toThrow(/faltan .*válidas/i);
  });

  it("only removes the beta state when live is explicit", () => {
    expect(isBetaRelease(validSupabaseEnvironment)).toBe(true);
    expect(
      isBetaRelease({
        ...validSupabaseEnvironment,
        NEXT_PUBLIC_RELEASE_STAGE: "live",
      }),
    ).toBe(false);
  });
});
