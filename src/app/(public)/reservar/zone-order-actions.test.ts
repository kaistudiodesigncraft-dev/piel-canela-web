import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { calculateOrderTotal } from "@/lib/depilation-order";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/public-server", () => ({ createSupabasePublicServerClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ usesSupabaseDataSource: () => true }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }) }));
import { createPublicBooking, getAvailableSlots } from "./actions";

const treatmentId = "59000000-0000-4000-8000-000000000001";
const zoneIds = ["69000000-0000-4000-8000-000000000001", "69000000-0000-4000-8000-000000000002"];
const context = {
  treatmentId, treatmentName: "QA", specialtyId: "39000000-0000-4000-8000-000000000001", bufferMinutes: 15, startIntervalMinutes: 15,
  combo: null, zones: zoneIds.map((id, index) => ({ id, name: `Zone ${index}`, priceCents: 1000000, durationMinutes: 15 })),
  includedZones: [], comboMode: null, comboAudience: null, validityDays: null, discountPercent: 10, version: "test",
};
const input = {
  treatmentId, monthlySpecialId: null, zoneOrder: true, zoneIds,
  expectedTotalCents: 1800000, expectedDurationMinutes: 30,
  startsAt: "2026-10-29T12:00:00-03:00", idempotencyKey: "89000000-0000-4000-8000-000000000001",
  fullName: "QA Test", phone: "3510000000", email: "", notes: "",
};
beforeEach(() => {
  vi.stubEnv("DEPILATION_ZONES_ENABLED", "true");
  vi.stubEnv("BOOKING_GUARD_SECRET", "q".repeat(64));
  rpc.mockReset();
  rpc.mockImplementation(async (name: string) => name === "get_depilation_order_context"
    ? { data: context, error: null }
    : name === "get_available_slots_for_zone_order" ? { data: [], error: null }
    : { data: [{ booking_id: "qa", booking_code: "PC-QA", status: "pending" }], error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("server-authoritative zone order", () => {
  it("loads inputs from DB, uses the shared formula and signs the immutable quote", async () => {
    expect(await createPublicBooking(input)).toMatchObject({ ok: true });
    const call = rpc.mock.calls.find(([name]) => name === "create_booking_for_zone_order")!;
    const args = call[1] as { payload: string; signature: string };
    const payload = JSON.parse(args.payload) as { order: unknown; context: unknown };
    expect(payload.order).toEqual(calculateOrderTotal(context));
    expect(payload.context).toEqual(context);
    const key = createHash("sha256").update("q".repeat(64)).digest("hex");
    expect(args.signature).toBe(createHmac("sha256", key).update(args.payload).digest("hex"));
    expect(rpc).toHaveBeenCalledWith("get_depilation_order_context", { requested_treatment_id: treatmentId, requested_combo_id: null, requested_zone_ids: zoneIds });
  });
  it("does not accept forged totals, specials, legacy pricing or a disabled feature", async () => {
    expect(await createPublicBooking({ ...input, expectedTotalCents: 1 })).toEqual({ ok: false, reason: "price_changed" });
    expect(await createPublicBooking({ ...input, monthlySpecialId: treatmentId })).toEqual({ ok: false, reason: "invalid" });
    expect(await createPublicBooking({ ...input, zoneOrder: false, zoneIds: [], comboId: treatmentId })).toEqual({ ok: false, reason: "invalid" });
    expect(await getAvailableSlots({ ...input, date: "2026-10-29", zoneOrder: false, zoneIds: [], comboId: treatmentId })).toEqual({ ok: false, reason: "invalid" });
    expect(rpc.mock.calls.some(([name]) => name === "create_booking_for_zone_order")).toBe(false);
    vi.stubEnv("DEPILATION_ZONES_ENABLED", "false");
    expect(await createPublicBooking(input)).toEqual({ ok: false, reason: "treatment" });
  });
  it("checks the same server quote before offering availability", async () => {
    expect(await getAvailableSlots({ ...input, date: "2026-10-29" })).toEqual({ ok: true, slots: [] });
    expect(await getAvailableSlots({ ...input, date: "2026-10-29", expectedDurationMinutes: 15 })).toEqual({ ok: false, reason: "price_changed" });
    expect(rpc.mock.calls.filter(([name]) => name === "get_available_slots_for_zone_order")).toHaveLength(1);
  });
});
