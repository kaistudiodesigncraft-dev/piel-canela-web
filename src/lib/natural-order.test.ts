import { describe, expect, it } from "vitest";
import { sortByNaturalName } from "./natural-order";

describe("sortByNaturalName", () => {
  it("orders names alphabetically while treating embedded numbers naturally", () => {
    const items = [
      { id: "4", name: "Combo Mujeres 10" },
      { id: "3", name: "Combo Mujeres 2" },
      { id: "2", name: "Combo Hombres 11" },
      { id: "1", name: "Combo Hombres 3" },
    ];

    expect(sortByNaturalName(items).map((item) => item.name)).toEqual([
      "Combo Hombres 3",
      "Combo Hombres 11",
      "Combo Mujeres 2",
      "Combo Mujeres 10",
    ]);
  });

  it("ignores accents and letter case without mutating the original array", () => {
    const items = [
      { id: "3", name: "Espalda" },
      { id: "2", name: "axilas" },
      { id: "1", name: "Ábdomen" },
    ];

    expect(sortByNaturalName(items).map((item) => item.name)).toEqual([
      "Ábdomen",
      "axilas",
      "Espalda",
    ]);
    expect(items.map((item) => item.name)).toEqual(["Espalda", "axilas", "Ábdomen"]);
  });
});
