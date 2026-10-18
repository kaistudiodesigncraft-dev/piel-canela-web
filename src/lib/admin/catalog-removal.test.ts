import { describe, expect, it } from "vitest";
import { catalogRemovalError } from "./catalog-removal";

describe("catalog removal support messages", () => {
  it("explains how to recover from concurrent changes", () => {
    expect(catalogRemovalError("40001")).toMatch(/recargá/);
  });
  it("explains the missing migration without exposing server diagnostics", () => {
    expect(catalogRemovalError("PGRST202", "secret database details")).toMatch(/pendiente de habilitación/);
    expect(catalogRemovalError("unknown", "secret database details")).not.toContain("secret");
  });
  it("provides an actionable destination conflict", () => {
    expect(catalogRemovalError("23P01")).toMatch(/fechas/);
  });
});
