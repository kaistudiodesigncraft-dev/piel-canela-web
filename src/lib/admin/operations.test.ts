import { describe, expect, it } from "vitest";
import {
  adminSubmittedDateTimeToIso,
  argentinaLocalDateTimeToIso,
  availableBookingStatusTransitions,
  BOOKING_STATUS_TRANSITIONS,
  bookingSearchText,
  bookingStatusRequiresReason,
  pesosToCents,
  slugifySpecialty,
  toArgentinaDateTimeInput,
} from "./operations";

describe("admin operations", () => {
  it("creates stable slugs for reusable specialties", () => {
    expect(slugifySpecialty("  Kinesiología Deportiva ")).toBe("kinesiologia-deportiva");
  });

  it("converts Córdoba local input to an absolute instant", () => {
    expect(argentinaLocalDateTimeToIso("2026-08-17T09:30")).toBe("2026-08-17T12:30:00.000Z");
    expect(argentinaLocalDateTimeToIso("invalid")).toBeNull();
    expect(adminSubmittedDateTimeToIso("2026-08-17T09:30")).toBe("2026-08-17T12:30:00.000Z");
    expect(adminSubmittedDateTimeToIso("2026-08-17T12:30:00.000Z")).toBe("2026-08-17T12:30:00.000Z");
    expect(adminSubmittedDateTimeToIso("invalid")).toBeNull();
    expect(toArgentinaDateTimeInput("2026-08-17T12:30:00.000Z")).toBe("2026-08-17T09:30");
  });

  it("normalizes prices and searchable booking content", () => {
    expect(pesosToCents(42500)).toBe(4_250_000);
    expect(bookingSearchText({
      code: "PC-1234",
      customerName: "María Pérez",
      phone: "351 555 0000",
      treatmentName: "Relajación profunda",
    })).toContain("maria perez");
  });

  it("requires an operational reason for cancellation and absence", () => {
    expect(bookingStatusRequiresReason("cancelled")).toBe(true);
    expect(bookingStatusRequiresReason("no_show")).toBe(true);
    expect(bookingStatusRequiresReason("confirmed")).toBe(false);
  });

  it("lets reception recover an expired future reservation without reopening a stale pending hold", () => {
    expect(BOOKING_STATUS_TRANSITIONS.expired).toEqual(["awaiting_deposit", "confirmed"]);
    expect(availableBookingStatusTransitions("expired", "2026-11-05T21:00:00.000Z", "2026-10-30T12:00:00.000Z"))
      .toEqual(["awaiting_deposit", "confirmed"]);
    expect(availableBookingStatusTransitions("expired", "2026-10-29T21:00:00.000Z", "2026-10-30T12:00:00.000Z"))
      .toEqual([]);
    expect(BOOKING_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });
});
