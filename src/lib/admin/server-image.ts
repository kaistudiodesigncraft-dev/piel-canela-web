import "server-only";

import sharp from "sharp";
import {
  ADMIN_IMAGE_MAX_BYTES,
  ADMIN_IMAGE_MAX_PIXELS,
  ADMIN_IMAGE_MIN_HEIGHT,
  ADMIN_IMAGE_MIN_WIDTH,
} from "@/lib/admin/image-upload";

export type NormalizedAdminImage =
  | { ok: true; data: Buffer; width: number; height: number; mimeType: "image/webp" }
  | { ok: false; error: "decode" | "dimensions" | "too-small" | "too-large" | "output-size" };

/** Decodes the full input, applies EXIF orientation, strips metadata and emits one WebP frame. */
export async function normalizeAdminImageOnServer(input: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<NormalizedAdminImage> {
  try {
    const source = Buffer.from(await input.arrayBuffer());
    const decoder = sharp(source, {
      animated: false,
      failOn: "error",
      limitInputPixels: ADMIN_IMAGE_MAX_PIXELS,
    });
    const metadata = await decoder.metadata();
    if (!metadata.width || !metadata.height) return { ok: false, error: "dimensions" };
    if (metadata.width < ADMIN_IMAGE_MIN_WIDTH || metadata.height < ADMIN_IMAGE_MIN_HEIGHT) {
      return { ok: false, error: "too-small" };
    }
    if (metadata.width * metadata.height > ADMIN_IMAGE_MAX_PIXELS) return { ok: false, error: "too-large" };
    const output = await decoder.rotate().webp({ quality: 84, effort: 4 }).toBuffer({ resolveWithObject: true });
    if (output.data.byteLength > ADMIN_IMAGE_MAX_BYTES) return { ok: false, error: "output-size" };
    return { ok: true, data: output.data, width: output.info.width, height: output.info.height, mimeType: "image/webp" };
  } catch {
    return { ok: false, error: "decode" };
  }
}
