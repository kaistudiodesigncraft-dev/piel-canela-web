import { describe, expect, it } from "vitest";
import { treatmentSaveRequiresReload } from "./treatment-action-state";

describe("treatmentSaveRequiresReload", () => {
  it("blocks further saves only after a stale treatment conflict", () => {
    expect(treatmentSaveRequiresReload({ status: "invalid", error: "stale" })).toBe(true);
    expect(treatmentSaveRequiresReload({ status: "failed", error: "save" })).toBe(false);
    expect(treatmentSaveRequiresReload({ status: "idle" })).toBe(false);
  });
});
