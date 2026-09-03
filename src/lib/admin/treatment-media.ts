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

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const size = constrainedImageSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("image_canvas_unavailable");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await canvasToBlob(canvas);
    if (blob.size > ADMIN_IMAGE_MAX_BYTES) throw new Error("image_size");
    return { blob, ...size, sourceInspection: inspection };
  } finally {
    bitmap.close();
  }
}
