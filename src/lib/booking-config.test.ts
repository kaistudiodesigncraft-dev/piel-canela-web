import { describe, expect, it } from "vitest";
import { BookingConfigSchema, resolveTreatmentConfig } from "./booking-config";

const configured = {
  version: 1 as const,
  mode: "options" as const,
  optionsLabel: { singular: "zona", plural: "zonas" },
  selectionMode: "multiple" as const,
  minSelections: 1,
  maxSelections: 6,
  allowLooseOptions: true,
  allowCombos: false,
  allowAddons: false,
  priceRule: { type: "sum_with_volume_discount" as const, minOptions: 2, discountPercent: 5, appliesTo: "loose_options_only" as const },
  durationRule: { type: "sum_of_options" as const },
};

describe("BookingConfig", () => {
  it("accepts a valid configurable options treatment", () => {
    expect(BookingConfigSchema.parse(configured)).toEqual(configured);
  });

  it("rejects incompatible capabilities", () => {
    expect(() => BookingConfigSchema.parse({ ...configured, allowAddons: true })).toThrow();
    expect(() => BookingConfigSchema.parse({ ...configured, selectionMode: "single", maxSelections: 6 })).toThrow();
    expect(() => BookingConfigSchema.parse({
      ...configured,
      mode: "closed_combos",
      allowLooseOptions: false,
      allowCombos: true,
      selectionMode: "multiple",
      minSelections: 0,
      maxSelections: 0,
      priceRule: { type: "combo_price" },
      durationRule: { type: "sum_of_options" },
    })).toThrow();
  });

  it("keeps legacy treatments on the legacy adapter unless explicitly enabled", () => {
    const resolved = resolveTreatmentConfig({
      config_enabled: false,
      booking_config: configured,
      selection_mode: "simple",
      price_cents: 20_000,
      duration_minutes: 45,
    });
    expect(resolved.source).toBe("legacy");
    expect(resolved.config).toMatchObject({ mode: "simple", priceRule: { type: "fixed", priceCents: 20_000 } });
  });

  it("uses the versioned configuration only when explicitly enabled", () => {
    expect(resolveTreatmentConfig({
      config_enabled: true,
      booking_config: configured,
      selection_mode: "simple",
      price_cents: 0,
      duration_minutes: 1,
    })).toEqual({ source: "configured", config: configured });
  });

  it("does not identify the legacy flow by slug or treatment ID", () => {
    const first = resolveTreatmentConfig({ selection_mode: "combo_with_extras", price_cents: 0, duration_minutes: 30 });
    const second = resolveTreatmentConfig({ selection_mode: "combo_with_extras", price_cents: 0, duration_minutes: 30 });
    expect(first).toEqual(second);
    expect(first.config.mode).toBe("combos_with_addons");
  });
});
