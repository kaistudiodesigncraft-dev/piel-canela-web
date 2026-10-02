"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminSubmittedDateTimeToIso } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/admin/require-admin";

const notesSchema = z.object({
  bookingId: z.string().uuid(),
  customerNotes: z.string().trim().max(240).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
});

const rescheduleSchema = z.object({
  bookingId: z.string().uuid(),
  startsAt: z.string(),
});
const rescheduleSlotsSchema = z.object({
  bookingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type BookingRescheduleSlotsResult =
  | { ok: true; slots: { startsAt: string; endsAt: string }[] }
  | { ok: false; reason: "invalid" | "status" | "server" };

function reservationRedirect(params: string): never {
  redirect(`/admin?${params}#reservas`);
}

export async function getBookingRescheduleSlots(input: unknown): Promise<BookingRescheduleSlotsResult> {
  const { supabase } = await requireAdmin();
  const parsed = rescheduleSlotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { data, error } = await supabase.rpc("get_available_slots_for_reschedule", {
    requested_booking_id: parsed.data.bookingId,
    requested_date: parsed.data.date,
  });
  if (error) {
    return {
      ok: false,
      reason: error.message.includes("cannot_be_rescheduled") ? "status" : "server",
    };
  }
  return {
    ok: true,
    slots: ((data ?? []) as { starts_at: string; ends_at: string }[]).map((slot) => ({
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    })),
  };
}

export async function saveBookingNotes(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = notesSchema.safeParse({
    bookingId: formData.get("bookingId"),
    customerNotes: formData.get("customerNotes") || undefined,
    internalNotes: formData.get("internalNotes") || undefined,
  });
  if (!parsed.success) reservationRedirect("bookingDetailError=invalid");
  const { error } = await supabase.from("bookings").update({
    customer_notes: parsed.data.customerNotes || null,
    internal_notes: parsed.data.internalNotes || null,
  }).eq("id", parsed.data.bookingId);
  if (error) reservationRedirect("bookingDetailError=save");
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  reservationRedirect(`bookingDetailSaved=1&booking=${parsed.data.bookingId}`);
}

export async function rescheduleBooking(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = rescheduleSchema.safeParse({
    bookingId: formData.get("bookingId"),
    startsAt: formData.get("startsAt"),
  });
  const startsAt = parsed.success ? adminSubmittedDateTimeToIso(parsed.data.startsAt) : null;
  if (!parsed.success || !startsAt) reservationRedirect("rescheduleError=invalid");
  const { error } = await supabase.rpc("reschedule_admin_booking", {
    requested_booking_id: parsed.data.bookingId,
    requested_starts_at: startsAt,
  });
  if (error) {
    const reason = error.message.includes("slot_not_available")
      ? "conflict"
      : error.message.includes("cannot_be_rescheduled")
        ? "status"
        : "save";
    reservationRedirect(`rescheduleError=${reason}&booking=${parsed.data.bookingId}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  reservationRedirect(`rescheduleSaved=1&booking=${parsed.data.bookingId}`);
}
