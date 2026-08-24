import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashTreatmentDeleteCode(code: string) {
  return digest(code.trim());
}

export function isTreatmentDeleteCodeConfigured() {
  return Boolean(process.env.TREATMENT_DELETE_CODE_HASH);
}

export function verifyTreatmentDeleteCode(code: string) {
  const expected = process.env.TREATMENT_DELETE_CODE_HASH;
  if (!expected) return false;
  return safeEqual(hashTreatmentDeleteCode(code), expected.trim().toLowerCase());
}
