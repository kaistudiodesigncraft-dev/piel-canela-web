import { describe, expect, it } from "vitest";
import { monthlySpecials, treatments } from "@/data/fixtures";
import {
  buildBookingHref,
  buildCatalogHref,
  filterTreatmentsByCategory,
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

  it("returns zero, one and multiple active specials from the same contract", () => {
    const now = new Date("2026-07-31T12:00:00.000Z");

    expect(getPublicMonthlySpecials([], now)).toHaveLength(0);
    expect(getPublicMonthlySpecials(monthlySpecials.slice(0, 1), now)).toHaveLength(1);
    expect(getPublicMonthlySpecials(monthlySpecials, now)).toHaveLength(3);
  });
});

