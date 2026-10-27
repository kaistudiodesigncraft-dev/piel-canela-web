const SAFE_TOKEN = /[^a-zA-Z0-9_.:/-]/g;

export function createSupportCode(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
}

function safeToken(value: string | null | undefined, fallback = "unknown"): string {
  if (value && (value.includes("@") || /\d{8,}/.test(value) || /[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(value))) return "redacted";
  const normalized = value?.slice(0, 80).replace(SAFE_TOKEN, "_");
  return normalized || fallback;
}

export interface OperationalEvent {
  event: string;
  stage: string;
  code?: string | null;
  supportCode?: string;
  durationMs?: number;
  itemCount?: number;
  warningCount?: number;
}

/**
 * Emits only allow-listed operational metadata. Names, emails, phones, notes,
 * form values and database rows are intentionally not accepted by this API.
 */
export function reportOperationalEvent(input: OperationalEvent): void {
  const payload = {
    event: safeToken(input.event),
    stage: safeToken(input.stage),
    code: safeToken(input.code),
    ...(input.supportCode ? { supportCode: safeToken(input.supportCode) } : {}),
    ...(typeof input.durationMs === "number" ? { durationMs: Math.max(0, Math.round(input.durationMs)) } : {}),
    ...(typeof input.itemCount === "number" ? { itemCount: Math.max(0, Math.round(input.itemCount)) } : {}),
    ...(typeof input.warningCount === "number" ? { warningCount: Math.max(0, Math.round(input.warningCount)) } : {}),
  };
  const output = JSON.stringify(payload);
  if (input.code && input.code !== "ok") console.error(output);
  else console.info(output);
}
