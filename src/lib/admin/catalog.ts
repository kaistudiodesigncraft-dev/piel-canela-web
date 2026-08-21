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
}) {
  if (input.isActive) return "published" as const;
  if (input.imagePath && input.imageAlt?.trim()) return "ready" as const;
  return "draft" as const;
}

