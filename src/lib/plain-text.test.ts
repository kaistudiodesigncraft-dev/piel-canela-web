import { describe, expect, it } from "vitest";
import { containsEmoji, stripEmoji } from "./plain-text";

describe("plain text policy", () => {
  it("detects pictographic emoji without rejecting ordinary Spanish copy", () => {
    expect(containsEmoji("Explorá el catálogo y reservá tu turno.")).toBe(false);
    expect(containsEmoji(`Reserva ${String.fromCodePoint(0x2728)}`)).toBe(true);
    expect(containsEmoji(`Hola ${String.fromCodePoint(0x1f60a)}`)).toBe(true);
  });

  it("removes emoji sequences from public copy without changing ordinary text", () => {
    const symbol = `${String.fromCodePoint(0x2728)}\uFE0F`;
    expect(stripEmoji(`Explorá el catálogo ${symbol}`)).toBe("Explorá el catálogo");
    expect(stripEmoji("Piel Canela · Estética y bienestar")).toBe("Piel Canela · Estética y bienestar");
  });
});
