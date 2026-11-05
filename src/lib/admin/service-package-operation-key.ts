import { idempotencyUuid } from "@/lib/idempotency";

type ServicePackageOperation =
  | { type: "purchase"; bookingId: string }
  | { type: "session"; packageId: string; action: "reserve" | "reschedule"; bookingId: string | null; startsAt: string }
  | { type: "decision"; packageId: string; bookingId: string; action: "complete" | "release" | "lose" }
  | { type: "extend"; packageId: string; expectedValidityUntil: string; additionalDays: number; reason: string };

/**
 * Stable per business operation: duplicate submits replay safely, while a later
 * appointment or extension receives a different key.
 */
export function servicePackageOperationKey(operation: ServicePackageOperation) {
  switch (operation.type) {
    case "purchase":
      return idempotencyUuid(`service-package:purchase:${operation.bookingId}`);
    case "session":
      return idempotencyUuid(
        `service-package:session:${operation.packageId}:${operation.action}:${operation.bookingId ?? "new"}:${operation.startsAt}`,
      );
    case "decision":
      return idempotencyUuid(
        `service-package:decision:${operation.packageId}:${operation.bookingId}:${operation.action}`,
      );
    case "extend":
      return idempotencyUuid(
        `service-package:extend:${operation.packageId}:${operation.expectedValidityUntil}:${operation.additionalDays}:${operation.reason}`,
      );
  }
}
