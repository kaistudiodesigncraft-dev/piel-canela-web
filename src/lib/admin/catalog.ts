export const OCCUPYING_BOOKING_STATUSES = [
  "pending",
  "awaiting_deposit",
  "confirmed",
] as const;

export function splitAdminLines(value: string, limit: number) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function linesToAdminText(value: readonly string[]) {
  return value.join("\n");
}

export function percentageToFocalPoint(value: number) {
  return Math.round(value) / 100;
}

export function focalPointToPercentage(value: number | string) {
  return Math.round(Number(value) * 100);
}

export function getTreatmentPublicationState(input: {
  isActive: boolean;
  imagePath: string | null;
  imageAlt: string | null;
  shortDescription?: string;
  description?: string;
  priceCents?: number;
}) {
  if (input.isActive) return "published" as const;
  const imageIsValid = !input.imagePath || Boolean(input.imageAlt?.trim());
  if (
    imageIsValid
    && (input.shortDescription?.trim().length ?? 0) >= 10
    && (input.description?.trim().length ?? 0) >= 20
    && (input.priceCents ?? 0) > 0
  ) return "ready" as const;
  return "draft" as const;
}
