import { describe, expect, it } from "vitest";
import { servicePackageOperationKey } from "@/lib/admin/service-package-operation-key";

const packageId = "10000000-0000-4000-8000-000000000001";
const bookingId = "10000000-0000-4000-8000-000000000002";

describe("servicePackageOperationKey", () => {
  it("replays the same business operation with the same key", () => {
    const operation = { type: "session" as const, packageId, action: "reserve" as const, bookingId: null, startsAt: "2026-11-12T13:00:00.000Z" };
    expect(servicePackageOperationKey(operation)).toBe(servicePackageOperationKey(operation));
  });

  it("does not reuse a key for a later session", () => {
    const first = servicePackageOperationKey({ type: "session", packageId, action: "reserve", bookingId: null, startsAt: "2026-11-12T13:00:00.000Z" });
    const second = servicePackageOperationKey({ type: "session", packageId, action: "reserve", bookingId: null, startsAt: "2026-12-12T13:00:00.000Z" });
    expect(second).not.toBe(first);
  });

  it("separates decisions and extensions", () => {
    const complete = servicePackageOperationKey({ type: "decision", packageId, bookingId, action: "complete" });
    const release = servicePackageOperationKey({ type: "decision", packageId, bookingId, action: "release" });
    const firstExtension = servicePackageOperationKey({ type: "extend", packageId, expectedValidityUntil: "2027-01-01T00:00:00.000Z", additionalDays: 30, reason: "Solicitud de la clienta" });
    const laterExtension = servicePackageOperationKey({ type: "extend", packageId, expectedValidityUntil: "2027-01-31T00:00:00.000Z", additionalDays: 30, reason: "Solicitud de la clienta" });
    expect(release).not.toBe(complete);
    expect(laterExtension).not.toBe(firstExtension);
  });
});
