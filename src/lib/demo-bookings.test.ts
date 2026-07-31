import { describe, expect, it } from "vitest";
import { monthlySpecials, treatments } from "@/data/fixtures";
import {
  buildAdminDemoHref,
  resolveDemoBookingFromQuery,
} from "./demo-bookings";

describe("demo booking transport", () => {
  it("encodes a simulated booking for the admin demo", () => {
    const href = buildAdminDemoHref({
      id: "booking-demo",
      code: "PC-DEMO-4821",
      treatmentId: "treatment-relajacion",
      monthlySpecialId: "special-pausa-profunda",
      customerName: "Ana Demo",
      phone: "351 555 0099",
      startsAt: "2026-08-01T09:00:00-03:00",
      durationMinutes: 60,
      priceCents: 5500000,
      status: "pending",
      createdAt: "2026-07-31T23:30:00-03:00",
    });

    expect(href).toContain("demoCode=PC-DEMO-4821");
    expect(href).toContain("demoMonthlySpecialId=special-pausa-profunda");
  });

  it("reconstructs only a valid simulated booking", () => {
    const booking = resolveDemoBookingFromQuery(
      {
        demoCode: "PC-DEMO-4821",
        demoName: "Ana Demo",
        demoPhone: "351 555 0099",
        demoDate: "2026-08-01",
        demoTime: "09:00",
        demoTreatmentId: "treatment-relajacion",
        demoMonthlySpecialId: "special-pausa-profunda",
      },
      treatments,
      monthlySpecials,
    );

    expect(booking).toMatchObject({
      status: "pending",
      treatmentId: "treatment-relajacion",
      monthlySpecialId: "special-pausa-profunda",
      priceCents: 5500000,
      isNew: true,
    });
  });
});
