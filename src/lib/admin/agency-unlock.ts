import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "pc-agency-content";
const SESSION_SECONDS = 4 * 60 * 60;

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashAgencyUnlockCode(code: string) {
  return digest(code.trim());
}

export function isAgencyUnlockConfigured() {
  return Boolean(
    process.env.AGENCY_CONTENT_UNLOCK_CODE_HASH &&
      process.env.AGENCY_CONTENT_SESSION_SECRET,
  );
}

export function verifyAgencyUnlockCode(code: string) {
  const expected = process.env.AGENCY_CONTENT_UNLOCK_CODE_HASH;
  if (!expected) return false;
  return safeEqual(hashAgencyUnlockCode(code), expected.trim().toLowerCase());
}

function signature(payload: string) {
  const secret = process.env.AGENCY_CONTENT_SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

export async function createAgencyUnlockSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signed = signature(payload);
  if (!signed) throw new Error("El desbloqueo de contenido no está configurado.");

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${signed}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin/contenido",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearAgencyUnlockSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hasAgencyUnlockSession(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const tokenUserId = parts[0];
  const expiry = parts[1];
  const suppliedSignature = parts[2];
  if (!tokenUserId || !expiry || !suppliedSignature) return false;
  if (tokenUserId !== userId || !/^\d+$/.test(expiry)) return false;
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return false;

  const expectedSignature = signature(`${tokenUserId}.${expiry}`);
  return expectedSignature ? safeEqual(suppliedSignature, expectedSignature) : false;
}
