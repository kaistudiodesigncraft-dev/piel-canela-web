import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface BrandAssetManifest {
  assets: Array<{ path: string; role: string; sha256: string }>;
}

describe("Piel Canela brand contract", () => {
  it("keeps the five approved colors explicit in the semantic token layer", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/brand-system.css"), "utf8").toLocaleLowerCase();
    expect(css).toContain("--color-petrol: #377a86");
    expect(css).toContain("--color-aquamarine: #35d4b1");
    expect(css).toContain("--color-celeste: #8ccccc");
    expect(css).toContain("--color-graphite: #393939");
    expect(css).toContain("--color-white: #ffffff");
    expect(css).toContain('--font-accent: "fiona"');
  });

  it("detects accidental replacement or modification of approved assets", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "design/brand-assets.manifest.json"), "utf8")) as BrandAssetManifest;
    expect(manifest.assets.length).toBeGreaterThanOrEqual(15);
    for (const asset of manifest.assets) {
      const bytes = readFileSync(resolve(process.cwd(), asset.path));
      const digest = createHash("sha256").update(bytes).digest("hex");
      expect(digest, `${asset.role}: ${asset.path}`).toBe(asset.sha256);
    }
  });
});
