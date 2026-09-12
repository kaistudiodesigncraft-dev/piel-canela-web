import { createHmac, timingSafeEqual } from "node:crypto";
export function secretsMatch(actual: string | null, expected: string | undefined) {
  if (!actual || !expected || expected.length < 32) return false;
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validWebhookSignature(body: string, signature: string | null, secret: string | undefined) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return secretsMatch(signature, `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`);
}
