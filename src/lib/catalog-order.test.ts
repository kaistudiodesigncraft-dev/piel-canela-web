import { describe, expect, it } from "vitest";
import { sortCatalogItems, type CatalogGroup } from "./catalog-order";

type Item = { id: string; category: number; group: CatalogGroup; combo: boolean; order: number };
const descriptor = (item: Item) => ({ categoryOrder: item.category, catalogGroup: item.group, isCombo: item.combo, displayOrder: item.order });

describe("sortCatalogItems", () => {
  it("orders facial, brows, depilation and combos while preserving manual order", () => {
    const items: Item[] = [
      { id: "combo", category: 1, group: "default", combo: true, order: 1 },
      { id: "depilation", category: 1, group: "depilation", combo: false, order: 1 },
      { id: "brows", category: 1, group: "brows_lashes", combo: false, order: 2 },
      { id: "facial-b", category: 1, group: "facial", combo: false, order: 2 },
      { id: "facial-a", category: 1, group: "facial", combo: false, order: 1 },
    ];
    expect(sortCatalogItems(items, descriptor).map((item) => item.id)).toEqual([
      "facial-a", "facial-b", "brows", "depilation", "combo",
    ]);
  });

  it("is stable when all explicit sort values match", () => {
    const items: Item[] = ["a", "b", "c"].map((id) => ({ id, category: 1, group: "default", combo: false, order: 1 }));
    expect(sortCatalogItems(items, descriptor).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
