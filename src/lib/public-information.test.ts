import { describe, expect, it } from "vitest";
import { formatReceptionHours } from "./public-information";

describe("formatReceptionHours", () => {
  it("normalizes mixed 24-hour values with PM without changing stored data", () => {
    expect(formatReceptionHours("Lunes a viernes 16PM-20PM")).toBe("Lunes a viernes 16–20 h");
  });

  it("normalizes valid twelve-hour ranges", () => {
    expect(formatReceptionHours("9:30 AM - 6 PM")).toBe("9:30–18 h");
  });

  it("leaves prose without a time range unchanged", () => {
    expect(formatReceptionHours("Solo con turno previo")).toBe("Solo con turno previo");
  });
});
