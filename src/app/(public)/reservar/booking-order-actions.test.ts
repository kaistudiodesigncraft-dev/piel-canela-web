import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public-server", () => ({ createSupabasePublicServerClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ usesSupabaseDataSource: () => true }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }) }));
import { createPublicBooking, getAvailableDates, getAvailableSlots } from "./actions";

const treatmentId = "93000000-0000-4000-8000-000000000001";
const optionId = "94000000-0000-4000-8000-000000000001";
const context = {
  source: "configured",
  treatmentId,
  treatmentName: "Tratamiento configurable",
  specialtyId: "95000000-0000-4000-8000-000000000001",
  requiresProfessionalAssignment: true,
  bufferMinutes: 10,
  startIntervalMinutes: 15,
  bookingConfig: {
    version: 1,
    mode: "options",
    optionsLabel: { singular: "área", plural: "áreas" },
    selectionMode: "multiple",
    minSelections: 1,
    maxSelections: null,
    allowLooseOptions: true,
    allowCombos: false,
    allowAddons: false,
    priceRule: { type: "sum_of_options" },
    durationRule: { type: "sum_of_options" },
  },
  selection: { combinationId: null, optionIds: [optionId] },
  combination: null,
  options: [{ id: optionId, name: "Área", priceCents: 150000, durationMinutes: 20, displayOrder: 1, isActive: true }],
  includedOptions: [],
  version: "qa",
};
const selection = { combinationId: null, optionIds: [optionId] };
const baseInput = {
  treatmentId,
  bookingOrderV2: selection,
  expectedTotalCents: 150000,
  expectedDurationMinutes: 20,
};

beforeEach(() => {
  vi.stubEnv("BOOKING_GUARD_SECRET", "v".repeat(64));
  rpc.mockReset();
  rpc.mockImplementation(async (name: string) => {
    if (name === "get_booking_order_context_v2") return { data: context, error: null };
    if (name === "is_treatment_offered_on_date") return { data: true, error: null };
    if (name === "get_available_dates_for_booking_order_v2") return { data: [{ available_date: "2026-11-12" }], error: null };
    if (name === "get_available_slots_for_booking_order_v2") return { data: [{ starts_at: "2026-11-12T15:00:00Z", ends_at: "2026-11-12T15:30:00Z" }], error: null };
    if (name === "create_booking_for_booking_order_v2") return { data: [{ booking_id: "96000000-0000-4000-8000-000000000001", booking_code: "PC-V2", status: "pending" }], error: null };
    return { data: null, error: { message: `unexpected_rpc:${name}` } };
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("public booking-order-v2 actions", () => {
  it("uses only the generic availability RPCs for an explicitly configured selection", async () => {
    expect(await getAvailableDates({ ...baseInput, fromDate: "2026-11-01", toDate: "2026-11-30" })).toEqual({ ok: true, dates: ["2026-11-12"] });
    expect(await getAvailableSlots({ ...baseInput, date: "2026-11-12" })).toEqual({
      ok: true,
      slots: [{ startsAt: "2026-11-12T15:00:00Z", endsAt: "2026-11-12T15:30:00Z" }],
    });
    expect(rpc.mock.calls.some(([name]) => name === "get_available_dates_for_booking_order_v2")).toBe(true);
    expect(rpc.mock.calls.some(([name]) => name === "get_available_slots_for_booking_order_v2")).toBe(true);
    expect(rpc.mock.calls.some(([name]) => name === "get_available_dates_for_selection_v2")).toBe(false);
  });

  it("creates the pre-booking through the signed generic RPC", async () => {
    const result = await createPublicBooking({
      ...baseInput,
      monthlySpecialId: null,
      startsAt: "2026-11-12T15:00:00Z",
      idempotencyKey: "97000000-0000-4000-8000-000000000001",
      website: "",
      fullName: "Persona QA",
      phone: "3510000000",
      email: "",
      notes: "",
    });
    expect(result).toEqual({ ok: true, bookingId: "96000000-0000-4000-8000-000000000001", bookingCode: "PC-V2", status: "pending" });
    const call = rpc.mock.calls.find(([name]) => name === "create_booking_for_booking_order_v2");
    expect(call?.[1]).toEqual(expect.objectContaining({
      requested_idempotency_key: "97000000-0000-4000-8000-000000000001",
      customer_full_name: "Persona QA",
    }));
    expect(rpc.mock.calls.some(([name]) => name === "create_booking_for_selection_v2")).toBe(false);
  });

  it("rejects forged totals and mixed legacy fields before creating a booking", async () => {
    expect(await getAvailableSlots({ ...baseInput, expectedTotalCents: 1, date: "2026-11-12" })).toEqual({ ok: false, reason: "price_changed" });
    expect(await createPublicBooking({
      ...baseInput,
      comboId: "98000000-0000-4000-8000-000000000001",
      monthlySpecialId: null,
      startsAt: "2026-11-12T15:00:00Z",
      idempotencyKey: "99000000-0000-4000-8000-000000000001",
      website: "",
      fullName: "Persona QA",
      phone: "3510000000",
      email: "",
      notes: "",
    })).toEqual({ ok: false, reason: "invalid" });
    expect(rpc.mock.calls.some(([name]) => name === "create_booking_for_booking_order_v2")).toBe(false);
  });
});
