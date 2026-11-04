import { describe, expect, it } from "vitest";
import type { BookingConfig } from "./booking-config";
import { calculateOrder } from "./booking-engine";
import { GenericCatalog } from "./option-catalog";

const treatmentId = "treatment-a";
const options = [
  { id: "a", treatment_id: treatmentId, name: "A", price_cents: 1_800_000, duration_minutes: 15, display_order: 1, is_active: true },
  { id: "b", treatment_id: treatmentId, name: "B", price_cents: 3_000_000, duration_minutes: 30, display_order: 2, is_active: true },
  { id: "c", treatment_id: treatmentId, name: "C", price_cents: 2_000_000, duration_minutes: 20, display_order: 3, is_active: true },
];
const combinations = [{
  id: "combo", treatment_id: treatmentId, name: "Combo", kind: "combo" as const,
  price_cents: 4_500_000, duration_minutes: 45, included_option_ids: ["c"],
  allowed_addon_option_ids: null, session_count: 1, display_order: 1, is_active: true,
}, {
  id: "package", treatment_id: treatmentId, name: "Paquete", kind: "package" as const,
  price_cents: 10_000_000, duration_minutes: 60, included_option_ids: [],
  allowed_addon_option_ids: [], session_count: 6, display_order: 2, is_active: true,
}];
const catalog = new GenericCatalog(treatmentId, options, combinations);

const comboWithAddons: BookingConfig = {
  version: 1,
  mode: "combos_with_addons",
  optionsLabel: { singular: "zona", plural: "zonas" },
  selectionMode: "multiple",
  minSelections: 0,
  maxSelections: null,
  allowLooseOptions: true,
  allowCombos: true,
  allowAddons: true,
  priceRule: { type: "sum_with_volume_discount", minOptions: 2, discountPercent: 10, appliesTo: "loose_options_only" },
  durationRule: { type: "combo_plus_addons" },
};

describe("booking-engine", () => {
  it("keeps the combination price outside the volume discount", () => {
    expect(calculateOrder(comboWithAddons, catalog, { combinationId: "combo", optionIds: ["a", "b"] })).toMatchObject({
      subtotalCents: 9_300_000,
      looseOptionsSubtotalCents: 4_800_000,
      discountCents: 480_000,
      totalCents: 8_820_000,
      durationMinutes: 90,
    });
  });

  it("does not discount a single loose option", () => {
    expect(calculateOrder(comboWithAddons, catalog, { optionIds: ["a"] })).toMatchObject({
      discountPercent: 0,
      discountCents: 0,
      totalCents: 1_800_000,
      durationMinutes: 15,
    });
  });

  it("rejects duplicates and options already included in the combination", () => {
    expect(() => calculateOrder(comboWithAddons, catalog, { optionIds: ["a", "a"] })).toThrow("duplicate_option");
    expect(() => calculateOrder(comboWithAddons, catalog, { combinationId: "combo", optionIds: ["c"] })).toThrow("option_already_in_combination");
  });

  it("enforces package-only selections", () => {
    const packageConfig: BookingConfig = {
      version: 1, mode: "package", optionsLabel: { singular: "sesión", plural: "sesiones" },
      selectionMode: "single", minSelections: 0, maxSelections: 0,
      allowLooseOptions: false, allowCombos: true, allowAddons: false,
      priceRule: { type: "package_price" }, durationRule: { type: "per_session", durationMinutes: 60 },
    };
    expect(calculateOrder(packageConfig, catalog, { combinationId: "package", optionIds: [] })).toMatchObject({
      totalCents: 10_000_000,
      durationMinutes: 60,
    });
    expect(() => calculateOrder(packageConfig, catalog, { combinationId: "combo", optionIds: [] })).toThrow("package_required");
  });
});
