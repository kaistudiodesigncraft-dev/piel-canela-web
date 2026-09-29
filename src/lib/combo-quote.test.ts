import { describe, expect, it } from "vitest";
import type { TreatmentCombo } from "@/domain/treatment";
import { quoteCombo } from "./combo-quote";
import { resolveBookingSelection } from "./treatments";
import { treatments } from "@/data/fixtures";

const combo: TreatmentCombo = {
  id: "combo", treatmentId: "parent", name: "Ejemplo", description: "", audience: "women", mode: "package",
  sessionCount: 3, pricingMode: "fixed_price", fixedPriceCents: 24000, referencePriceCents: 30000,
  pricePerSessionCents: 8000, savingsCents: 6000, durationMinutes: 30, validityDays: 90,
  discountPercent: 20, tierMinItems: 2, tierDiscountPercent: 25, allowPublicExtras: true,
  zones: [{ id: "zone", name: "Zona", audience: "shared", referencePriceCents: 10000, durationMinutes: 30, isActive: true, displayOrder: 1 }],
  extras: [{ id: "extra", treatmentId: "parent", name: "Extra", description: "", audience: "shared", priceCents: 1000, durationMinutes: 10, isActive: true, displayOrder: 1 }],
  isActive: true, displayOrder: 1,
};
describe("quoteCombo: parity with resolve_booking_selection_v2", () => {
  it("adds extras for every session, but duration only once", () => {
    expect(quoteCombo(combo, ["extra"])).toMatchObject({ priceCents: 27000, referencePriceCents: 33000, pricePerSessionCents: 9000, savingsCents: 6000, durationMinutes: 40 });
  });
  it("uses the same authorized extras for names, price and occupied duration", () => {
    const treatment = treatments[0]!;
    const selection = resolveBookingSelection(treatment, undefined, { ...combo, allowPublicExtras: false }, combo.extras);
    expect(selection.extraIds).toEqual([]);
    expect(selection.comboExtras).toEqual([]);
    expect(selection.appliedPriceCents).toBe(combo.fixedPriceCents);
    expect(selection.durationMinutes).toBe(combo.durationMinutes);
    expect(selection.occupiedDurationMinutes).toBe(combo.durationMinutes + treatment.bufferMinutes);
  });
  it("discounts the reference total including extras", () => {
    expect(quoteCombo({ ...combo, pricingMode: "percentage_discount" }, ["extra"]).priceCents).toBe(26400);
  });
  it("counts items, not sessions, for tiered discounts", () => {
    const tiered = { ...combo, pricingMode: "tiered_discount" as const };
    expect(quoteCombo(tiered).priceCents).toBe(30000);
    expect(quoteCombo(tiered, ["extra"]).priceCents).toBe(24750);
  });
  it("ignores duplicate and unknown extra ids in the display estimate", () => {
    expect(quoteCombo(combo, ["extra", "extra", "unknown"])).toEqual(quoteCombo(combo, ["extra"]));
  });
  it("does not use inactive or incompatible extras", () => {
    expect(quoteCombo({ ...combo, extras: [{ ...combo.extras[0]!, audience: "men" }] }, ["extra"])).toEqual(quoteCombo(combo));
    expect(quoteCombo({ ...combo, allowPublicExtras: false }, ["extra"])).toEqual(quoteCombo(combo));
  });
  it("rounds half cents upwards like PostgreSQL numeric", () => {
    expect(quoteCombo({ ...combo, pricingMode: "percentage_discount", referencePriceCents: 101, discountPercent: 50 }).priceCents).toBe(51);
  });
});
