"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { argentinaLocalDateTimeToIso } from "@/lib/admin/operations";
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

function reservationRedirect(params: string): never {
  redirect(`/admin?${params}#reservas`);
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
  const startsAt = parsed.success ? argentinaLocalDateTimeToIso(parsed.data.startsAt) : null;
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
