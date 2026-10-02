import { describe, expect, it, vi } from "vitest";
import { Blob } from "node:buffer";
import sharp from "sharp";
import { normalizeAdminImageOnServer } from "@/lib/admin/server-image";

vi.mock("server-only", () => ({}));

describe("normalizeAdminImageOnServer", () => {
  it("decodes and emits a metadata-free WebP", async () => {
    const source = await sharp({
      create: { width: 800, height: 700, channels: 3, background: "#dce8df" },
    }).png().withMetadata({ orientation: 1 }).toBuffer();
    const result = await normalizeAdminImageOnServer(new Blob([source], { type: "image/png" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mimeType).toBe("image/webp");
    expect(result.width).toBe(800);
    expect(result.height).toBe(700);
    const metadata = await sharp(result.data).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects a corrupt file even when its prefix resembles WebP", async () => {
    const fakeHeader = Buffer.from("5249464618000000574542505650385800000000007f0200007f0200", "hex");
    await expect(normalizeAdminImageOnServer(new Blob([fakeHeader], { type: "image/webp" })))
      .resolves.toEqual({ ok: false, error: "decode" });
  });
});
