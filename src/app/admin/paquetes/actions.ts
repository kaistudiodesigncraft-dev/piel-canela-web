"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminSubmittedDateTimeToIso, argentinaLocalDateTimeToIso } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/admin/require-admin";

const packageSlotsSchema = z.object({
  packageId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const packageScheduleSchema = z.object({
  packageId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  startsAt: z.string().min(1),
  internalNotes: z.string().trim().max(1000),
});

export type PackageSessionSlotsResult =
  | { ok: true; slots: { startsAt: string; endsAt: string }[] }
  | { ok: false; reason: "invalid" | "unavailable" | "server" };

export async function getPackageSessionSlots(input: unknown): Promise<PackageSessionSlotsResult> {
  const { supabase } = await requireAdmin();
  const parsed = packageSlotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { data, error } = await supabase.rpc("get_available_slots_for_package", {
    requested_package_id: parsed.data.packageId,
    requested_date: parsed.data.date,
  });
  if (error) return { ok: false, reason: error.message.includes("package_not_available") ? "unavailable" : "server" };
  return {
    ok: true,
    slots: ((data ?? []) as { starts_at: string; ends_at: string }[]).map((slot) => ({
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    })),
  };
}

export async function schedulePackageSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = packageScheduleSchema.safeParse({
    packageId: formData.get("packageId"),
    idempotencyKey: formData.get("idempotencyKey"),
    startsAt: formData.get("startsAt"),
    internalNotes: formData.get("internalNotes") || "",
  });
  const startsAt = parsed.success ? adminSubmittedDateTimeToIso(parsed.data.startsAt) : null;
  if (!parsed.success || !startsAt) redirect("/admin/paquetes?packageError=invalid");
  const { error } = await supabase.rpc("create_admin_package_booking", {
    requested_package_id: parsed.data.packageId,
    requested_starts_at: startsAt,
    requested_idempotency_key: parsed.data.idempotencyKey,
    requested_internal_notes: parsed.data.internalNotes || null,
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
