import { describe, expect, it } from "vitest";
import { buildBookingDates, buildWhatsAppUrl, formatBookingTime } from "./booking";

describe("booking presentation helpers", () => {
  it("builds consecutive local business dates", () => {
    const dates = buildBookingDates(new Date("2026-08-16T15:00:00.000Z"), 3);
    expect(dates.map((date) => date.value)).toEqual([
      "2026-08-16",
      "2026-08-17",
      "2026-08-18",
    ]);
  });

  it("formats slot time in Cordoba", () => {
    expect(formatBookingTime("2026-08-17T15:30:00.000Z")).toBe("12:30");
  });

  it("normalizes the WhatsApp number and encodes the message", () => {
    expect(buildWhatsAppUrl("+54 9 351 555-0000", "Hola Piel Canela")).toBe(
      "https://wa.me/5493515550000?text=Hola%20Piel%20Canela",
    );
  });
});
