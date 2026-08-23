import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

describe("robots metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks every crawler during beta", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "fixtures");
    vi.stubEnv("NEXT_PUBLIC_RELEASE_STAGE", "beta");

    expect(robots()).toMatchObject({
      rules: [{ userAgent: "*", disallow: "/" }],
    });
    expect(robots()).not.toHaveProperty("sitemap");
  });

  it("publishes the sitemap only when the release is live", () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "fixtures");
    vi.stubEnv("NEXT_PUBLIC_RELEASE_STAGE", "live");

    expect(robots()).toMatchObject({
      rules: [
        {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin/", "/auth/", "/reservar"],
        },
      ],
      sitemap: expect.stringContaining("/sitemap.xml"),
    });
  });
});
