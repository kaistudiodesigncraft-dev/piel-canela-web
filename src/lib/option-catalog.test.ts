import { describe, expect, it } from "vitest";
import type { DepilationZone, TreatmentCombo } from "@/domain/treatment";
import { GenericCatalog, LegacyDepilationCatalog } from "./option-catalog";

const zone: DepilationZone = {
  id: "zone-a", name: "Zona A", audience: "shared", referencePriceCents: 120_000,
  durationMinutes: 15, displayOrder: 1, isActive: true,
};

const combo: TreatmentCombo = {
  id: "combo-a", treatmentId: "treatment-a", name: "Combo A", description: "",
  audience: "shared", mode: "single_session", sessionCount: 1, pricingMode: "fixed_price",
  discountPercent: null, tierMinItems: null, tierDiscountPercent: null, allowPublicExtras: true,
  fixedPriceCents: 100_000, referencePriceCents: 120_000, pricePerSessionCents: 100_000,
  savingsCents: 20_000, durationMinutes: 15, validityDays: null, zones: [zone], extras: [],
  displayOrder: 1, isActive: true,
};

describe("OptionCatalog adapters", () => {
  it("maps the legacy catalog without inferring a treatment by name or slug", () => {
    const catalog = new LegacyDepilationCatalog("treatment-a", [zone], [combo]);
    expect(catalog.getOption("zone-a")).toMatchObject({ priceCents: 120_000, durationMinutes: 15 });
    expect(catalog.getCombination("combo-a")).toMatchObject({
      priceCents: 100_000,
      includedOptionIds: ["zone-a"],
      allowedAddonOptionIds: null,
    });
  });

  it("isolates neutral catalog rows by treatment", () => {
    const catalog = new GenericCatalog("treatment-a", [
      { id: "option-a", treatment_id: "treatment-a", name: "A", price_cents: 1_000, duration_minutes: 10, display_order: 1, is_active: true },
      { id: "foreign", treatment_id: "treatment-b", name: "B", price_cents: 2_000, duration_minutes: 20, display_order: 1, is_active: true },
    ], [{
      id: "combination-a", treatment_id: "treatment-a", name: "Combo", kind: "combo",
      price_cents: 900, duration_minutes: 10, included_option_ids: ["option-a"],
      allowed_addon_option_ids: [], session_count: 1, display_order: 1, is_active: true,
    }]);
    expect(catalog.listOptions().map((item) => item.id)).toEqual(["option-a"]);
    expect(catalog.listCombinations()).toHaveLength(1);
  });
});
