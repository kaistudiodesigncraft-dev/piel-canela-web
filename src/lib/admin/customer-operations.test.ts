import { describe, expect, it } from "vitest";
import {
  buildAdminWhatsAppMessage,
  canRescheduleBooking,
  customerSearchText,
  normalizePhone,
} from "./customer-operations";

describe("customer operations", () => {
  it("keeps rescheduling limited to active booking states", () => {
    expect(canRescheduleBooking("confirmed")).toBe(true);
    expect(canRescheduleBooking("cancelled")).toBe(false);
    expect(canRescheduleBooking("completed")).toBe(false);
  });

  it("normalizes contact data for search and WhatsApp", () => {
    expect(normalizePhone("+54 9 351-555 0000")).toBe("5493515550000");
    expect(customerSearchText({ fullName: "María Pérez", phone: "351", email: "maria@example.com" }))
      .toContain("maria perez");
  });

  it("builds an operational message without claiming confirmation", () => {
    const message = buildAdminWhatsAppMessage({
      customerName: "Laura",
      bookingCode: "PC-AB12",
      treatmentName: "Masaje",
      startsAtLabel: "viernes 21, 15:30",
    });
    expect(message).toContain("Reserva: PC-AB12");
    expect(message).not.toContain("confirmada");
  });
});
