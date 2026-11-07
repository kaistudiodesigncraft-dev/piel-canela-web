import { describe, expect, it } from "vitest";
import { shouldAttachLegacyZoneOrder } from "./public-booking-strategy";

describe("public booking catalog routing", () => {
  it("keeps the classified historical depilation treatment on the legacy zone catalog", () => {
    expect(shouldAttachLegacyZoneOrder({ configEnabled: false, selectionMode: "closed_combo", catalogGroup: "depilation" })).toBe(true);
    expect(shouldAttachLegacyZoneOrder({ configEnabled: false, selectionMode: "combo_with_extras", catalogGroup: "depilation" })).toBe(true);
  });

  it("does not leak depilation zones into another configurable treatment", () => {
    expect(shouldAttachLegacyZoneOrder({ configEnabled: false, selectionMode: "combo_with_extras", catalogGroup: "default" })).toBe(false);
  });

  it("never attaches the legacy zone catalog to an explicitly configured treatment", () => {
    expect(shouldAttachLegacyZoneOrder({ configEnabled: true, selectionMode: "combo_with_extras", catalogGroup: "depilation" })).toBe(false);
    expect(shouldAttachLegacyZoneOrder({ configEnabled: true, selectionMode: "simple", catalogGroup: "default" })).toBe(false);
  });

  it("leaves legacy simple treatments unchanged", () => {
    expect(shouldAttachLegacyZoneOrder({ configEnabled: false, selectionMode: "simple", catalogGroup: "default" })).toBe(false);
  });
});
