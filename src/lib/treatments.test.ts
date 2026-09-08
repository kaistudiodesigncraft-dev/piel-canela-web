import { describe, expect, it } from "vitest";
import { monthlySpecials, treatments } from "@/data/fixtures";
import {
  buildBookingHref,
  buildCatalogHref,
  filterTreatmentsByCategory,
  getMonthlySpecialForTreatment,
  getPublicMonthlySpecials,
  resolveBookingSelection,
} from "./treatments";

describe("treatment domain helpers", () => {
  it("filters only active treatments from the selected category", () => {
    const result = filterTreatmentsByCategory(treatments, "category-bienestar");

    expect(result).toHaveLength(2);
    expect(result.every((treatment) => treatment.categoryId === "category-bienestar")).toBe(true);
    expect(result.every((treatment) => treatment.isActive)).toBe(true);
  });

  it("keeps the category in the shareable catalog URL", () => {
    expect(buildCatalogHref("bienestar", "relajacion-profunda", "special-pausa-profunda"))
      .toBe("/tratamientos?category=bienestar&treatment=relajacion-profunda&monthlySpecial=special-pausa-profunda#catalogo");
  });

  it("transfers treatment and monthly special to the booking placeholder", () => {
    expect(buildBookingHref({
      treatmentId: "treatment-relajacion",
      monthlySpecialId: "special-pausa-profunda",
    })).toBe("/reservar?treatmentId=treatment-relajacion&monthlySpecialId=special-pausa-profunda");
  });

  it("transfers a closed combo without inventing a cart", () => {
    expect(buildBookingHref({
      treatmentId: "treatment-depilacion",
      comboId: "combo-cerrado",
    })).toBe("/reservar?treatmentId=treatment-depilacion&comboId=combo-cerrado");
  });

  it("resolves the applied price without overwriting the base price", () => {
    const treatment = treatments.find((item) => item.id === "treatment-relajacion");
    const special = monthlySpecials.find((item) => item.id === "special-pausa-profunda");
    expect(treatment).toBeDefined();
    expect(special).toBeDefined();

    const selection = resolveBookingSelection(treatment!, special);
    expect(selection.basePriceCents).toBe(6500000);
    expect(selection.appliedPriceCents).toBe(5500000);
    expect(selection.monthlySpecialId).toBe("special-pausa-profunda");
  });

  it("resolves a closed combo using its zones, package price and one treatment buffer", () => {
    const treatment = treatments[0]!;
    const combo = {
      id: "50000000-0000-4000-8000-000000000001",
      treatmentId: treatment.id,
      name: "Paquete cerrado",
      description: "Dos zonas.",
      audience: "shared" as const,
      mode: "package" as const,
      sessionCount: 6,
      fixedPriceCents: 6000000,
      referencePriceCents: 7200000,
      pricePerSessionCents: 1000000,
      savingsCents: 1200000,
      durationMinutes: 45,
      validityDays: 120,
      zones: [
        { id: "60000000-0000-4000-8000-000000000001", name: "Zona A", audience: "shared" as const, referencePriceCents: 600000, durationMinutes: 20, displayOrder: 1, isActive: true },
        { id: "60000000-0000-4000-8000-000000000002", name: "Zona B", audience: "shared" as const, referencePriceCents: 600000, durationMinutes: 25, displayOrder: 2, isActive: true },
      ],
      displayOrder: 1,
      isActive: true,
    };

    const selection = resolveBookingSelection(treatment, undefined, combo);
    expect(selection.durationMinutes).toBe(45);
    expect(selection.occupiedDurationMinutes).toBe(45 + treatment.bufferMinutes);
    expect(selection.appliedPriceCents).toBe(6000000);
    expect(selection.pricePerSessionCents).toBe(1000000);
    expect(selection.comboZones).toEqual(["Zona A", "Zona B"]);
  });

  it("rejects stacking a monthly special with a closed combo", () => {
    const treatment = treatments[0]!;
    const special = monthlySpecials[0]!;
    const combo = {
      id: "50000000-0000-4000-8000-000000000001",
      treatmentId: treatment.id,
      name: "Combo cerrado",
      description: "",
      audience: "shared" as const,
      mode: "single_session" as const,
      sessionCount: 1,
      fixedPriceCents: 1000000,
      referencePriceCents: 1200000,
      pricePerSessionCents: 1000000,
      savingsCents: 200000,
      durationMinutes: 20,
      validityDays: null,
      zones: [],
      displayOrder: 1,
      isActive: true,
    };

    expect(() => resolveBookingSelection(treatment, special, combo))
      .toThrow("Los combos cerrados no acumulan especiales del mes.");
  });

  it("returns zero, one and multiple active specials from the same contract", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");

    expect(getPublicMonthlySpecials([], now)).toHaveLength(0);
    expect(getPublicMonthlySpecials(monthlySpecials.slice(0, 1), now)).toHaveLength(1);
    expect(getPublicMonthlySpecials(monthlySpecials, now)).toHaveLength(3);
  });

  it("only applies a current special linked to the selected treatment", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");
    const current = getMonthlySpecialForTreatment(
      monthlySpecials,
      "special-pausa-profunda",
      "treatment-relajacion",
      now,
    );
    const mismatched = getMonthlySpecialForTreatment(
      monthlySpecials,
      "special-pausa-profunda",
      "treatment-kinesica",
      now,
    );
    const expired = getMonthlySpecialForTreatment(
      monthlySpecials,
      "special-pausa-profunda",
      "treatment-relajacion",
      new Date("2026-09-02T03:00:00.000Z"),
    );

    expect(current?.id).toBe("special-pausa-profunda");
    expect(mismatched).toBeUndefined();
    expect(expired).toBeUndefined();
  });
});
