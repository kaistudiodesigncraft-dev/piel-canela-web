"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { argentinaLocalDateTimeToIso } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/admin/require-admin";

export async function schedulePackageSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const packageId = z.string().uuid().safeParse(formData.get("packageId"));
  const startsAtInput = z.string().min(1).safeParse(formData.get("startsAt"));
  const notes = z.string().trim().max(1000).safeParse(formData.get("internalNotes") || "");
  const startsAt = startsAtInput.success ? argentinaLocalDateTimeToIso(startsAtInput.data) : null;
  if (!packageId.success || !startsAt || !notes.success) redirect("/admin/paquetes?packageError=invalid");
  const { error } = await supabase.rpc("create_admin_package_booking", {
    requested_package_id: packageId.data,
    requested_starts_at: startsAt,
    requested_idempotency_key: randomUUID(),
    requested_internal_notes: notes.data || null,
  });
  if (error) redirect(`/admin/paquetes?packageError=${error.message.includes("slot_not_available") ? "slot" : error.message.includes("no_sessions") ? "sessions" : "save"}`);
  revalidatePath("/admin");
  revalidatePath("/admin/paquetes");
  redirect("/admin/paquetes?packageScheduled=1");
}

export async function decidePackageConsumption(formData: FormData) {
  const { supabase } = await requireAdmin();
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  const consume = z.enum(["true", "false"]).safeParse(formData.get("consume"));
  const reason = z.string().trim().min(3).max(500).safeParse(formData.get("reason"));
  if (!bookingId.success || !consume.success || !reason.success) redirect("/admin/paquetes?redemptionError=invalid");
  const { error } = await supabase.rpc("set_package_session_consumption", {
    requested_booking_id: bookingId.data,
    requested_consume: consume.data === "true",
    requested_reason: reason.data,
  });
  if (error) redirect("/admin/paquetes?redemptionError=save");
  revalidatePath("/admin/paquetes");
  revalidatePath("/admin");
  redirect("/admin/paquetes?redemptionSaved=1");
}

export async function extendPackageValidity(formData: FormData) {
  const { supabase } = await requireAdmin();
  const packageId = z.string().uuid().safeParse(formData.get("packageId"));
  const expiresAtInput = z.string().min(1).safeParse(formData.get("expiresAt"));
  const reason = z.string().trim().min(3).max(500).safeParse(formData.get("reason"));
  const expiresAt = expiresAtInput.success ? argentinaLocalDateTimeToIso(expiresAtInput.data) : null;
  if (!packageId.success || !expiresAt || !reason.success) redirect("/admin/paquetes?extensionError=invalid");
  const { error } = await supabase.rpc("extend_customer_package", { requested_package_id: packageId.data, requested_expires_at: expiresAt, requested_reason: reason.data });
  if (error) redirect("/admin/paquetes?extensionError=save");
  revalidatePath("/admin/paquetes");
  redirect("/admin/paquetes?extensionSaved=1");
}
