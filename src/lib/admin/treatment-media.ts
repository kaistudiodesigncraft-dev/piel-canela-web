import {
  ADMIN_IMAGE_MAX_BYTES,
  inspectAdminImage,
  type AdminImageInspection,
} from "@/lib/admin/image-upload";

export const TREATMENT_MEDIA_INGEST_BUCKET = "treatment-media-ingest";
export const TREATMENT_MEDIA_BUCKET = "treatment-media";
export const TREATMENT_MEDIA_OUTPUT_TYPE = "image/webp";
export const TREATMENT_MEDIA_MAX_EDGE = 3200;

export interface MediaUploadIntent {
  id: string;
  path: string;
  token: string;
  expiresAt: string;
}

export type TreatmentMediaStage =
  | "idle"
  | "preparing"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

export function constrainedImageSize(width: number, height: number, maxEdge = TREATMENT_MEDIA_MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("image_normalization_failed")),
      TREATMENT_MEDIA_OUTPUT_TYPE,
      0.9,
    );
  });
}

async function decodeTreatmentImage(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  try {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await createImageBitmap(file);
    }
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  } catch {
    // A valid image can still fail createImageBitmap on some Windows/browser
    // combinations. The HTML image decoder is a reliable second path and also
    // applies the displayed EXIF orientation before canvas export.
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = document.createElement("img");
      image.src = objectUrl;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight) throw new Error("image_decode_failed");
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      };
    } catch {
      URL.revokeObjectURL(objectUrl);
      throw new Error("image_decode_failed");
    }
  }
}

/**
 * Rendering through a canvas applies the browser's EXIF orientation and emits a
 * fresh WebP without the source metadata. The server still verifies the uploaded
 * signature and dimensions before it can be associated with a treatment.
 */
export async function normalizeTreatmentImage(file: File): Promise<{
  blob: Blob;
  width: number;
  height: number;
  sourceInspection: Extract<AdminImageInspection, { valid: true }>;
}> {
  const inspection = await inspectAdminImage(file);
  if (!inspection.valid) throw new Error(`image_${inspection.error}`);

  const decoded = await decodeTreatmentImage(file);
  try {
    const size = constrainedImageSize(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_canvas_unavailable");
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas);
    if (blob.size > ADMIN_IMAGE_MAX_BYTES) throw new Error("image_size");
    return { blob, ...size, sourceInspection: inspection };
  } finally {
    decoded.cleanup();
  }
}
