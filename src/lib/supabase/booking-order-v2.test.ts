import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const legacyQuote = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./public-server", () => ({
  createSupabasePublicServerClient: () => ({ rpc }),
}));
vi.mock("./depilation-order", () => ({
  createZoneOrderQuote: (...args: unknown[]) => legacyQuote(...args),
}));

import {
  createBookingOrderQuoteV2,
  createRoutedBookingOrderQuote,
} from "./booking-order-v2";

const treatmentId = "10000000-0000-4000-8000-000000000001";
const specialtyId = "20000000-0000-4000-8000-000000000001";
const optionA = "30000000-0000-4000-8000-000000000001";
const optionB = "30000000-0000-4000-8000-000000000002";
const combinationId = "40000000-0000-4000-8000-000000000001";
const secret = "s".repeat(64);

const context = {
  source: "configured",
  treatmentId,
  treatmentName: "Tratamiento configurable",
  specialtyId,
  requiresProfessionalAssignment: true,
  bufferMinutes: 15,
  startIntervalMinutes: 30,
  bookingConfig: {
    version: 1,
    mode: "combos_with_addons",
    optionsLabel: { singular: "zona", plural: "zonas" },
    selectionMode: "multiple",
    minSelections: 0,
    maxSelections: null,
    allowLooseOptions: true,
    allowCombos: true,
    allowAddons: true,
    priceRule: {
      type: "sum_with_volume_discount",
      minOptions: 2,
      discountPercent: 10,
      appliesTo: "loose_options_only",
    },
    durationRule: { type: "combo_plus_addons" },
  },
  selection: { combinationId, optionIds: [optionA, optionB] },
  combination: {
    id: combinationId,
    name: "Combo base",
    kind: "combo",
    priceCents: 300_000,
    durationMinutes: 30,
    includedOptionIds: [],
    allowedAddonOptionIds: [optionA, optionB],
    sessionCount: 1,
  },
  options: [
    { id: optionA, name: "Opción A", priceCents: 100_000, durationMinutes: 15, displayOrder: 1, isActive: true },
    { id: optionB, name: "Opción B", priceCents: 200_000, durationMinutes: 20, displayOrder: 2, isActive: true },
  ],
  includedOptions: [],
  version: "version-1",
};

describe("booking order v2 quote", () => {
  beforeEach(() => {
    rpc.mockReset();
    legacyQuote.mockReset();
    rpc.mockResolvedValue({ data: context, error: null });
  });

  it("calculates and signs an authoritative configured order", async () => {
    const quote = await createBookingOrderQuoteV2(
      { treatmentId, combinationId, optionIds: [optionA, optionB] },
      secret,
    );
    expect(quote.order).toMatchObject({
      subtotalCents: 600_000,
      discountCents: 30_000,
      totalCents: 570_000,
      durationMinutes: 65,
    });
    expect(JSON.parse(quote.payload)).toMatchObject({ purpose: "booking-order-v2", context });
    const key = createHash("sha256").update(secret).digest("hex");
    expect(quote.signature).toBe(createHmac("sha256", key).update(quote.payload).digest("hex"));
  });

  it("delegates a non-simple legacy treatment without using a slug or ID rule", async () => {
    legacyQuote.mockResolvedValue({ payload: "legacy", signature: "signed", order: { totalCents: 1 } });
    const result = await createRoutedBookingOrderQuote({
      configEnabled: false,
      selectionMode: "combo_with_extras",
      selection: { treatmentId, combinationId, optionIds: [optionA] },
      secret,
    });
    expect(result.path).toBe("legacy");
    expect(legacyQuote).toHaveBeenCalledWith(treatmentId, combinationId, [optionA], secret);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not move a simple legacy treatment into either configurable engine", async () => {
    await expect(createRoutedBookingOrderQuote({
      configEnabled: false,
      selectionMode: "simple",
      selection: { treatmentId, combinationId: null, optionIds: [] },
      secret,
    })).rejects.toThrow("simple_flow_required");
    expect(legacyQuote).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
