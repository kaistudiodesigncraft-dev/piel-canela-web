import { describe, expect, it } from "vitest";
import { createDefaultBookingConfig, isLegacyConfigReadOnly } from "./booking-config-editor";

describe("booking config editor defaults", () => {
  it.each([
    "simple",
    "options",
    "closed_combos",
    "combos_with_addons",
    "package",
  ] as const)("creates a valid %s configuration", (mode) => {
    expect(createDefaultBookingConfig({ mode, priceCents: 100_000, durationMinutes: 45 }).mode).toBe(mode);
  });

  it("locks every non-simple legacy treatment without identifying it by slug or ID", () => {
    expect(isLegacyConfigReadOnly({ configEnabled: false, legacySelectionMode: "combo_with_extras" })).toBe(true);
    expect(isLegacyConfigReadOnly({ configEnabled: false, legacySelectionMode: "simple" })).toBe(false);
    expect(isLegacyConfigReadOnly({ configEnabled: true, legacySelectionMode: "combo_with_extras" })).toBe(false);
  });
});
