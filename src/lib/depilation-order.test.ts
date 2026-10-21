import { describe, expect, it } from "vitest";
import { calculateOrderTotal, DISCOUNT_MIN_ZONES } from "./depilation-order";

const a = { id: "a", name: "Axilas", priceCents: 1800000, durationMinutes: 15 };
const b = { id: "b", name: "Piernas", priceCents: 3000000, durationMinutes: 30 };
const combo = { id: "combo", name: "Combo", priceCents: 4500000, durationMinutes: 45, includedZoneIds: ["c"], sessionCount: 1 };
describe("zone order pricing", () => {
  it("does not discount a single zone", () => {
    expect(DISCOUNT_MIN_ZONES).toBe(2);
    expect(calculateOrderTotal({ zones: [a], discountPercent: 15 })).toMatchObject({ totalCents: 1800000, discountCents: 0, durationMinutes: 15 });
  });
  it("discounts only loose zones, never the fixed combo", () => {
    expect(calculateOrderTotal({ combo, zones: [a, b], discountPercent: 10 })).toMatchObject({ subtotalCents: 9300000, discountCents: 480000, totalCents: 8820000, durationMinutes: 90 });
    expect(calculateOrderTotal({ combo, zones: [a], discountPercent: 10 }).totalCents).toBe(6300000);
    expect(calculateOrderTotal({ combo, zones: [], discountPercent: 100 }).totalCents).toBe(4500000);
  });
  it("supports zero and full discounts and rounds once in ARS", () => {
    expect(calculateOrderTotal({ zones: [a,b], discountPercent: 0 }).totalCents).toBe(4800000);
    expect(calculateOrderTotal({ zones: [a,b], discountPercent: 100 }).totalCents).toBe(0);
    expect(calculateOrderTotal({ zones: [{...a,priceCents:10000},{...b,priceCents:10100}], discountPercent: 12.5 }).discountCents).toBe(2500);
  });
  it("rejects duplicates, combo overlap, invalid amounts and discounts", () => {
    expect(() => calculateOrderTotal({zones:[a,a],discountPercent:10})).toThrow("duplicate_zone");
    expect(() => calculateOrderTotal({combo,zones:[{...a,id:"c"}],discountPercent:10})).toThrow("zone_already_in_combo");
    for(const discountPercent of [-1,101,NaN]) expect(() => calculateOrderTotal({zones:[a],discountPercent})).toThrow();
    expect(() => calculateOrderTotal({zones:[{...a,priceCents:0}],discountPercent:0})).toThrow();
  });
});
