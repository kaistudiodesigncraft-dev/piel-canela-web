export const ADMIN_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const ADMIN_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const ADMIN_IMAGE_MIN_WIDTH = 640;
export const ADMIN_IMAGE_MIN_HEIGHT = 640;
export const ADMIN_IMAGE_MAX_PIXELS = 40_000_000;

export type AdminImageValidationError =
  | "type"
  | "size"
  | "signature"
  | "dimensions"
  | "too-small"
  | "too-large";

export type AdminImageInspection =
  | { valid: true; width: number; height: number }
  | { valid: false; error: AdminImageValidationError };

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

async function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("image_read_failed"));
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
  }
  throw new Error("image_read_not_supported");
}

function uint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array) {
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1]!;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    return {
      width: uint24LittleEndian(bytes, 24) + 1,
      height: uint24LittleEndian(bytes, 27) + 1,
    };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
      height: 1 + ((bytes[22]! & 0xc0) >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 0x0f) << 10),
    };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  return null;
}

function avifDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 4; index + 16 <= bytes.length; index += 1) {
    if (ascii(bytes, index, 4) !== "ispe") continue;
    return { width: view.getUint32(index + 8), height: view.getUint32(index + 12) };
  }
  return null;
}

function hasSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
  }
  if (type === "image/webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  if (type === "image/avif") return ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4));
  return false;
}

export async function hasExpectedImageSignature(file: File) {
  const bytes = new Uint8Array(await readBlob(file.slice(0, 32)));
  return hasSignature(bytes, file.type);
}

export async function inspectAdminImage(file: File): Promise<AdminImageInspection> {
  if (!ADMIN_IMAGE_TYPES.has(file.type)) return { valid: false, error: "type" };
  if (file.size > ADMIN_IMAGE_MAX_BYTES) return { valid: false, error: "size" };

  const bytes = new Uint8Array(await readBlob(file));
  if (!hasSignature(bytes, file.type)) return { valid: false, error: "signature" };

  const dimensions = file.type === "image/png"
    ? pngDimensions(bytes)
    : file.type === "image/jpeg"
      ? jpegDimensions(bytes)
      : file.type === "image/webp"
        ? webpDimensions(bytes)
        : avifDimensions(bytes);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    return { valid: false, error: "dimensions" };
  }
  if (dimensions.width < ADMIN_IMAGE_MIN_WIDTH || dimensions.height < ADMIN_IMAGE_MIN_HEIGHT) {
    return { valid: false, error: "too-small" };
  }
  if (dimensions.width * dimensions.height > ADMIN_IMAGE_MAX_PIXELS) {
    return { valid: false, error: "too-large" };
  }
  return { valid: true, ...dimensions };
}
