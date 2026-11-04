import { describe, expect, it } from "vitest";
import { shouldAttachLegacyZoneOrder } from "./public-booking-strategy";

describe("public booking catalog routing", () => {
  it("keeps every historical non-simple treatment on the legacy zone catalog", () => {
    expect(shouldAttachLegacyZoneOrder({ configEnabled: false, selectionMode: "closed_combo" })).toBe(true);
    expect(shouldAttachLegacyZoneOrder({ configEnabled: false, selectionMode: "combo_with_extras" })).toBe(true);
  });

  it("never attaches the legacy zone catalog to an explicitly configured treatment", () => {
    expect(shouldAttachLegacyZoneOrder({ configEnabled: true, selectionMode: "combo_with_extras" })).toBe(false);
    expect(shouldAttachLegacyZoneOrder({ configEnabled: true, selectionMode: "simple" })).toBe(false);
  });

  it("leaves legacy simple treatments unchanged", () => {
    expect(shouldAttachLegacyZoneOrder({ configEnabled: false, selectionMode: "simple" })).toBe(false);
  });
});
