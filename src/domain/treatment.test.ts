import { describe, expect, it } from "vitest";
import { treatmentUsesCombos } from "./treatment";

describe("treatmentUsesCombos", () => {
  it("recognizes both configurable treatment modes", () => {
    expect(treatmentUsesCombos("closed_combo")).toBe(true);
    expect(treatmentUsesCombos("combo_with_extras")).toBe(true);
    expect(treatmentUsesCombos("simple")).toBe(false);
  });
});
