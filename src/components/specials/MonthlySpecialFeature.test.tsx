import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { monthlySpecials, treatmentCategories, treatments } from "@/data/fixtures";
import type { Treatment } from "@/domain/treatment";
import { MonthlySpecialFeature } from "./MonthlySpecialFeature";

describe("MonthlySpecialFeature", () => {
  it("promotes a closed-combo treatment without inventing or stacking a special price", () => {
    const baseTreatment = treatments[0]!;
    const treatment: Treatment = {
      ...baseTreatment,
      selectionMode: "closed_combo",
      priceCents: 0,
      combos: [{
        id: "50000000-0000-4000-8000-000000000001",
        treatmentId: baseTreatment.id,
        name: "Combo publicado",
        description: "Combinación cerrada.",
        audience: "shared",
        mode: "single_session",
        sessionCount: 1,
        pricingMode: "fixed_price",
        discountPercent: null,
        tierMinItems: null,
        tierDiscountPercent: null,
        allowPublicExtras: false,
        fixedPriceCents: 1800000,
        referencePriceCents: 2000000,
        pricePerSessionCents: 1800000,
        savingsCents: 200000,
        durationMinutes: 30,
        validityDays: null,
        zones: [],
        extras: [],
        displayOrder: 1,
        isActive: true,
      }],
    };
    const special = {
      ...monthlySpecials[0]!,
      treatmentId: treatment.id,
      pricingMode: "combo_catalog" as const,
      specialPriceCents: 0,
      referencePriceCents: null,
    };

    render(<MonthlySpecialFeature special={special} treatment={treatment} category={treatmentCategories[0]!} />);

    expect(screen.getByText("1 combo disponible")).toBeInTheDocument();
    expect(screen.queryByText("$ 0")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver combos/i })).toHaveAttribute(
      "href",
      `/tratamientos?category=${treatmentCategories[0]!.slug}&treatment=${treatment.slug}#catalogo`,
    );
  });
});
