"use server";

import { createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { usesSupabaseDataSource } from "@/lib/supabase/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { createZoneOrderQuote } from "@/lib/supabase/depilation-order";

const zoneSelectionFields = {
  zoneOrder: z.boolean().optional().default(false),
  zoneIds: z.array(z.string().uuid()).max(100).optional().default([]),
  expectedTotalCents: z.number().int().nonnegative().optional(),
  expectedDurationMinutes: z.number().int().positive().optional(),
};

const availabilitySchema = z.object({
  ...zoneSelectionFields,
  treatmentId: z.string().uuid(),
  comboId: z.string().uuid().nullable().optional().default(null),
  extraIds: z.array(z.string().uuid()).optional().default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const availableDatesSchema = z.object({
  ...zoneSelectionFields,
  treatmentId: z.string().uuid(),
  comboId: z.string().uuid().nullable().optional().default(null),
  extraIds: z.array(z.string().uuid()).optional().default([]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const bookingSchema = z.object({
  ...zoneSelectionFields,
  treatmentId: z.string().uuid(),
  monthlySpecialId: z.string().uuid().nullable(),
  comboId: z.string().uuid().nullable().optional().default(null),
  extraIds: z.array(z.string().uuid()).optional().default([]),
  startsAt: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().uuid(),
  website: z.string().max(0).optional().default(""),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(30),
  email: z.union([z.string().trim().email().max(180), z.literal("")]),
  notes: z.string().trim().max(240),
});

export type AvailabilityResult =
  | { ok: true; slots: { startsAt: string; endsAt: string }[] }
  | { ok: false; reason: "configuration" | "invalid" | "unavailable" | "price_changed" };

export type AvailableDatesResult =
  | { ok: true; dates: string[] }
  | { ok: false; reason: "configuration" | "invalid" | "unavailable" | "price_changed" };

export type CreateBookingResult =
  | { ok: true; bookingId: string; bookingCode: string; status: "pending" }
  | { ok: false; reason: "invalid" | "slot" | "treatment" | "special" | "rate_limited" | "verification" | "server" | "price_changed" };

function createBookingGuard(input: {
  secret: string;
  fingerprintSource: string;
}) {
  const nonce = randomUUID();
  const fingerprint = createHmac("sha256", input.secret)
    .update(input.fingerprintSource, "utf8")
    .digest("hex");

  return { nonce, fingerprint };
}

export async function getAvailableSlots(input: unknown): Promise<AvailabilityResult> {
  if (!usesSupabaseDataSource()) return { ok: false, reason: "configuration" };
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  // Once enabled, configurable bookings cannot opt back into legacy pricing.
  if (process.env.DEPILATION_ZONES_ENABLED === "true" && parsed.data.comboId && !parsed.data.zoneOrder) return { ok: false, reason: "invalid" };

  const supabase = createSupabasePublicServerClient();
  const offeredResult = await supabase.rpc("is_treatment_offered_on_date", {
    requested_treatment_id: parsed.data.treatmentId,
    requested_date: parsed.data.date,
  });
  if (offeredResult.error) return { ok: false, reason: "unavailable" };
  if (!offeredResult.data) return { ok: true, slots: [] };
  if (parsed.data.zoneOrder) {
    const secret = process.env.BOOKING_GUARD_SECRET;
    if (!secret || secret.length < 32) return { ok: false, reason: "configuration" };
    if (parsed.data.extraIds.length) return { ok: false, reason: "invalid" };
    try {
      const quote = await createZoneOrderQuote(parsed.data.treatmentId, parsed.data.comboId, parsed.data.zoneIds, secret);
      if (quote.order.totalCents !== parsed.data.expectedTotalCents || quote.order.durationMinutes !== parsed.data.expectedDurationMinutes) return { ok: false, reason: "price_changed" };
      const { data, error } = await supabase.rpc("get_available_slots_for_zone_order", {
        payload: quote.payload, signature: quote.signature, requested_date: parsed.data.date,
      });
      if (error) return { ok: false, reason: error.message.includes("quote_changed") ? "price_changed" : "unavailable" };
      return { ok: true, slots: ((data ?? []) as { starts_at: string; ends_at: string }[]).map(s => ({ startsAt: s.starts_at, endsAt: s.ends_at })) };
    } catch { return { ok: false, reason: "unavailable" }; }
  }
  if (parsed.data.zoneIds.length) return { ok: false, reason: "invalid" };
  const { data, error } = parsed.data.comboId
    ? await supabase.rpc("get_available_slots_for_selection_v2", {
        requested_treatment_id: parsed.data.treatmentId,
        requested_combo_id: parsed.data.comboId,
        requested_date: parsed.data.date,
        requested_extra_ids: parsed.data.extraIds,
      })
    : await supabase.rpc("get_available_slots", {
        requested_treatment_id: parsed.data.treatmentId,
        requested_date: parsed.data.date,
      });
  if (error) return { ok: false, reason: "unavailable" };

  return {
    ok: true,
    slots: ((data ?? []) as { starts_at: string; ends_at: string }[]).map((slot) => ({
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    })),
  };
}

export async function getAvailableDates(input: unknown): Promise<AvailableDatesResult> {
  if (!usesSupabaseDataSource()) return { ok: false, reason: "configuration" };
  const parsed = availableDatesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const from = new Date(`${parsed.data.fromDate}T12:00:00Z`);
  const to = new Date(`${parsed.data.toDate}T12:00:00Z`);
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0 || days > 366) return { ok: false, reason: "invalid" };
  if (process.env.DEPILATION_ZONES_ENABLED === "true" && parsed.data.comboId && !parsed.data.zoneOrder) return { ok: false, reason: "invalid" };

  const supabase = createSupabasePublicServerClient();
  if (parsed.data.zoneOrder) {
    const secret = process.env.BOOKING_GUARD_SECRET;
    if (!secret || secret.length < 32 || parsed.data.extraIds.length) return { ok: false, reason: "configuration" };
    try {
      const quote = await createZoneOrderQuote(parsed.data.treatmentId, parsed.data.comboId, parsed.data.zoneIds, secret);
      if (quote.order.totalCents !== parsed.data.expectedTotalCents || quote.order.durationMinutes !== parsed.data.expectedDurationMinutes) return { ok: false, reason: "price_changed" };
      const { data, error } = await supabase.rpc("get_available_dates_for_zone_order", {
        payload: quote.payload,
        signature: quote.signature,
        requested_from_date: parsed.data.fromDate,
        requested_to_date: parsed.data.toDate,
      });
      if (error) return { ok: false, reason: error.message.includes("quote_changed") ? "price_changed" : "unavailable" };
      return { ok: true, dates: ((data ?? []) as { available_date: string }[]).map((row) => row.available_date) };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }
  if (parsed.data.zoneIds.length) return { ok: false, reason: "invalid" };
  const { data, error } = await supabase.rpc("get_available_dates_for_selection_v2", {
    requested_treatment_id: parsed.data.treatmentId,
    requested_combo_id: parsed.data.comboId,
    requested_from_date: parsed.data.fromDate,
    requested_to_date: parsed.data.toDate,
    requested_extra_ids: parsed.data.extraIds,
  });
  if (error) return { ok: false, reason: "unavailable" };
  return { ok: true, dates: ((data ?? []) as { available_date: string }[]).map((row) => row.available_date) };
}

export async function createPublicBooking(input: unknown): Promise<CreateBookingResult> {
  if (!usesSupabaseDataSource()) return { ok: false, reason: "server" };
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  if (process.env.DEPILATION_ZONES_ENABLED === "true" && parsed.data.comboId && !parsed.data.zoneOrder) return { ok: false, reason: "invalid" };

  const guardSecret = process.env.BOOKING_GUARD_SECRET;
  if (!guardSecret || guardSecret.length < 32) {
    return { ok: false, reason: "server" };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const fingerprintSource = forwardedFor || requestHeaders.get("x-real-ip") || "unknown";
  const guard = createBookingGuard({ secret: guardSecret, fingerprintSource });

  const supabase = createSupabasePublicServerClient();
  if (parsed.data.zoneIds.length && !parsed.data.zoneOrder) return { ok: false, reason: "invalid" };
  let zoneQuote: Awaited<ReturnType<typeof createZoneOrderQuote>> | undefined;
  if (parsed.data.zoneOrder) {
    if (parsed.data.monthlySpecialId || parsed.data.extraIds.length) return { ok: false, reason: "invalid" };
    try {
      zoneQuote = await createZoneOrderQuote(parsed.data.treatmentId, parsed.data.comboId, parsed.data.zoneIds, guardSecret);
    } catch { return { ok: false, reason: "treatment" }; }
    // Client values only detect a changed offer; authoritative values always come from the database.
    if (zoneQuote.order.totalCents !== parsed.data.expectedTotalCents || zoneQuote.order.durationMinutes !== parsed.data.expectedDurationMinutes) return { ok: false, reason: "price_changed" };
  }
  const { data, error } = zoneQuote ? await supabase.rpc("create_booking_for_zone_order", {
    payload: zoneQuote.payload, signature: zoneQuote.signature,
    requested_starts_at: parsed.data.startsAt, requested_idempotency_key: parsed.data.idempotencyKey,
    customer_full_name: parsed.data.fullName, customer_phone: parsed.data.phone,
    customer_email: parsed.data.email || null, customer_notes: parsed.data.notes || null,
    request_guard_nonce: guard.nonce, request_guard_fingerprint: guard.fingerprint, request_guard_secret: guardSecret,
  }) : await supabase.rpc("create_booking_for_selection_v2", {
    requested_treatment_id: parsed.data.treatmentId,
    requested_combo_id: parsed.data.comboId,
    requested_monthly_special_id: parsed.data.monthlySpecialId,
    requested_starts_at: parsed.data.startsAt,
    requested_idempotency_key: parsed.data.idempotencyKey,
    customer_full_name: parsed.data.fullName,
    customer_phone: parsed.data.phone,
    customer_email: parsed.data.email || null,
    customer_notes: parsed.data.notes || null,
    request_guard_nonce: guard.nonce,
    request_guard_fingerprint: guard.fingerprint,
    request_guard_secret: guardSecret,
    requested_extra_ids: parsed.data.extraIds,
  });

  if (error) {
    if (error.message.includes("quote_changed") || error.message.includes("quote_expired")) return { ok: false, reason: "price_changed" };
    if (error.message.includes("slot_not_available")) return { ok: false, reason: "slot" };
    if (error.message.includes("treatment_not_available")) return { ok: false, reason: "treatment" };
    if (error.message.includes("monthly_special_not_available")) return { ok: false, reason: "special" };
    if (error.message.includes("combo_") || error.message.includes("closed_combos")) return { ok: false, reason: "treatment" };
    if (error.message.includes("booking_rate_limited")) return { ok: false, reason: "rate_limited" };
    if (error.message.includes("booking_guard_")) return { ok: false, reason: "verification" };
    return { ok: false, reason: "server" };
  }

  const row = (data as { booking_id: string; booking_code: string; status: "pending" }[] | null)?.[0];
  if (!row) return { ok: false, reason: "server" };
  return {
    ok: true,
    bookingId: row.booking_id,
    bookingCode: row.booking_code,
    status: row.status,
  };
}
