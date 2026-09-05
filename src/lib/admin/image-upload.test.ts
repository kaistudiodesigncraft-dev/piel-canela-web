import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_IMAGE_MAX_BYTES,
  hasExpectedImageSignature,
  inspectAdminImage,
} from "./image-upload";

function signatureFile(bytes: number[], type: string) {
  return {
    type,
    slice: () => ({
      arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    }),
  } as unknown as File;
}

describe("administrative image validation", () => {
  it("accepts the real QA catalog image", async () => {
    const bytes = readFileSync(resolve("src/lib/admin/__fixtures__/treatment-upload-valid.png"));
    const file = new File([bytes], "treatment-upload-valid.png", { type: "image/png" });

    await expect(inspectAdminImage(file)).resolves.toMatchObject({
      valid: true,
      width: 1254,
      height: 1254,
    });
  });

  it("accepts a matching PNG signature", async () => {
    const file = signatureFile(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0],
      "image/png",
    );
    expect(await hasExpectedImageSignature(file)).toBe(true);
  });

  it("rejects text renamed as an image", async () => {
    const file = signatureFile([0x63, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x69, 0x64, 0x6f], "image/png");
    expect(await hasExpectedImageSignature(file)).toBe(false);
  });

  it("reads dimensions from a valid PNG", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 1080);
    view.setUint32(20, 1350);
    const file = new File([bytes], "tratamiento.png", { type: "image/png" });

    await expect(inspectAdminImage(file)).resolves.toEqual({ valid: true, width: 1080, height: 1350 });
  });

  it("rejects images that are too small for a reliable crop", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 480);
    view.setUint32(20, 600);
    const file = new File([bytes], "miniatura.png", { type: "image/png" });

    await expect(inspectAdminImage(file)).resolves.toEqual({ valid: false, error: "too-small" });
  });

  it("rejects files over the storage limit before reading their contents", async () => {
    const file = {
      type: "image/png",
      size: ADMIN_IMAGE_MAX_BYTES + 1,
      arrayBuffer: () => { throw new Error("should not read an oversized file"); },
    } as unknown as File;

    await expect(inspectAdminImage(file)).resolves.toEqual({ valid: false, error: "size" });
  });
});
