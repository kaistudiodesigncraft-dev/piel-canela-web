"use server";

import { createHmac, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { usesSupabaseDataSource } from "@/lib/supabase/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

const availabilitySchema = z.object({
  treatmentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const bookingSchema = z.object({
  treatmentId: z.string().uuid(),
  monthlySpecialId: z.string().uuid().nullable(),
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
  | { ok: false; reason: "configuration" | "invalid" | "unavailable" };

export type CreateBookingResult =
  | { ok: true; bookingId: string; bookingCode: string; status: "pending" }
  | { ok: false; reason: "invalid" | "slot" | "treatment" | "special" | "rate_limited" | "verification" | "server" };

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

  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
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

export async function createPublicBooking(input: unknown): Promise<CreateBookingResult> {
  if (!usesSupabaseDataSource()) return { ok: false, reason: "server" };
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const guardSecret = process.env.BOOKING_GUARD_SECRET;
  if (!guardSecret || guardSecret.length < 32) {
    return { ok: false, reason: "server" };
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const fingerprintSource = forwardedFor || requestHeaders.get("x-real-ip") || "unknown";
  const guard = createBookingGuard({ secret: guardSecret, fingerprintSource });

  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase.rpc("create_booking", {
    requested_treatment_id: parsed.data.treatmentId,
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
  });

  if (error) {
    if (error.message.includes("slot_not_available")) return { ok: false, reason: "slot" };
    if (error.message.includes("treatment_not_available")) return { ok: false, reason: "treatment" };
    if (error.message.includes("monthly_special_not_available")) return { ok: false, reason: "special" };
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
