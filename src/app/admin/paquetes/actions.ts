"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminSubmittedDateTimeToIso, argentinaLocalDateTimeToIso } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/admin/require-admin";
import { servicePackageOperationKey } from "@/lib/admin/service-package-operation-key";

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
const universalPackageSlotsSchema = packageSlotsSchema.extend({
  excludedBookingId: z.string().uuid().nullable().optional(),
});
const universalPackagePurchaseSchema = z.object({
  bookingId: z.string().uuid(),
  paymentStatus: z.enum(["deposit_pending", "deposit_paid", "paid_in_full"]),
});
const universalPackageScheduleSchema = z.object({
  packageId: z.string().uuid(),
  bookingId: z.string().uuid().nullable().optional(),
  action: z.enum(["reserve", "reschedule"]),
  startsAt: z.string().min(1),
});
const universalPackageDecisionSchema = z.object({
  packageId: z.string().uuid(),
  bookingId: z.string().uuid(),
  action: z.enum(["complete", "release", "lose"]),
  reason: z.string().trim().max(500),
});
const universalPackageExtensionSchema = z.object({
  packageId: z.string().uuid(),
  additionalDays: z.coerce.number().int().min(1).max(730),
  reason: z.string().trim().min(3).max(500),
  expectedValidityUntil: z.string().datetime({ offset: true }),
});
const universalPackagePaymentSchema = z.object({
  packageId: z.string().uuid(),
  paymentStatus: z.enum(["deposit_paid", "paid_in_full"]),
});

export type PackageSessionSlotsResult =
  | { ok: true; slots: { startsAt: string; endsAt: string }[] }
  | { ok: false; reason: "invalid" | "unavailable" | "server" };

function universalPackageError(message: string) {
  if (message.includes("slot_not_available")) return "slot";
  if (message.includes("no_sessions")) return "sessions";
  if (message.includes("not_available")) return "unavailable";
  if (message.includes("reason_required")) return "reason";
  if (message.includes("reschedule_limit")) return "reschedule";
  if (message.includes("validity_changed")) return "stale";
  return "save";
}

export async function getPackageSessionSlots(input: unknown): Promise<PackageSessionSlotsResult> {
  const { supabase } = await requireAdmin();
  const parsed = packageSlotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { data, error } = await supabase.rpc("get_available_slots_for_package_v2", {
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

export async function registerUniversalPackage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = universalPackagePurchaseSchema.safeParse({
    bookingId: formData.get("bookingId"),
    paymentStatus: formData.get("paymentStatus"),
  });
  if (!parsed.success) redirect("/admin/paquetes?universalError=invalid");
  const { error } = await supabase.rpc("register_service_package_purchase_v2", {
    requested_booking_id: parsed.data.bookingId,
    requested_payment_status: parsed.data.paymentStatus,
    requested_idempotency_key: servicePackageOperationKey({
      type: "purchase",
      bookingId: parsed.data.bookingId,
    }),
  });
  if (error) redirect(`/admin/paquetes?universalError=${universalPackageError(error.message)}`);
  revalidatePath("/admin");
  revalidatePath("/admin/paquetes");
  redirect("/admin/paquetes?universalSaved=purchase");
}

export async function getUniversalPackageSlots(input: unknown): Promise<PackageSessionSlotsResult> {
  const { supabase } = await requireAdmin();
  const parsed = universalPackageSlotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { data, error } = await supabase.rpc("get_available_slots_for_service_package", {
    requested_package_id: parsed.data.packageId,
    requested_date: parsed.data.date,
    excluded_booking_id: parsed.data.excludedBookingId ?? null,
  });
  if (error) return { ok: false, reason: error.message.includes("not_available") ? "unavailable" : "server" };
  return {
    ok: true,
    slots: ((data ?? []) as { starts_at: string; ends_at: string }[]).map((slot) => ({
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    })),
  };
}

export async function scheduleUniversalPackageSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = universalPackageScheduleSchema.safeParse({
    packageId: formData.get("packageId"),
    bookingId: formData.get("bookingId") || null,
    action: formData.get("action"),
    startsAt: formData.get("startsAt"),
  });
  const startsAt = parsed.success ? adminSubmittedDateTimeToIso(parsed.data.startsAt) : null;
  if (!parsed.success || !startsAt) redirect("/admin/paquetes?universalError=invalid");
  const { error } = await supabase.rpc("manage_service_package_session", {
    requested_package_id: parsed.data.packageId,
    requested_action: parsed.data.action,
    requested_idempotency_key: servicePackageOperationKey({
      type: "session",
      packageId: parsed.data.packageId,
      action: parsed.data.action,
      bookingId: parsed.data.bookingId ?? null,
      startsAt,
    }),
    requested_booking_id: parsed.data.bookingId ?? null,
    requested_starts_at: startsAt,
    requested_event_at: new Date().toISOString(),
    requested_reason: null,
  });
  if (error) redirect(`/admin/paquetes?universalError=${universalPackageError(error.message)}`);
  revalidatePath("/admin");
  revalidatePath("/admin/paquetes");
  redirect(`/admin/paquetes?universalSaved=${parsed.data.action}`);
}

export async function decideUniversalPackageSession(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = universalPackageDecisionSchema.safeParse({
    packageId: formData.get("packageId"),
    bookingId: formData.get("bookingId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) redirect("/admin/paquetes?universalError=invalid");
  const { error } = await supabase.rpc("manage_service_package_session", {
    requested_package_id: parsed.data.packageId,
    requested_action: parsed.data.action,
    requested_idempotency_key: servicePackageOperationKey({
      type: "decision",
      packageId: parsed.data.packageId,
      bookingId: parsed.data.bookingId,
      action: parsed.data.action,
    }),
    requested_booking_id: parsed.data.bookingId,
    requested_starts_at: null,
    requested_event_at: new Date().toISOString(),
    requested_reason: parsed.data.reason || null,
  });
  if (error) redirect(`/admin/paquetes?universalError=${universalPackageError(error.message)}`);
  revalidatePath("/admin");
  revalidatePath("/admin/paquetes");
  redirect(`/admin/paquetes?universalSaved=${parsed.data.action}`);
}

export async function extendUniversalPackageValidity(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = universalPackageExtensionSchema.safeParse({
    packageId: formData.get("packageId"),
    additionalDays: formData.get("additionalDays"),
    reason: formData.get("reason"),
    expectedValidityUntil: formData.get("expectedValidityUntil"),
  });
  if (!parsed.success) redirect("/admin/paquetes?universalError=invalid");
  const { error } = await supabase.rpc("extend_service_package_validity_v2", {
    requested_package_id: parsed.data.packageId,
    requested_expected_validity_until: parsed.data.expectedValidityUntil,
    requested_additional_days: parsed.data.additionalDays,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: servicePackageOperationKey({
      type: "extend",
      packageId: parsed.data.packageId,
      expectedValidityUntil: parsed.data.expectedValidityUntil,
      additionalDays: parsed.data.additionalDays,
      reason: parsed.data.reason,
    }),
  });
  if (error) redirect(`/admin/paquetes?universalError=${universalPackageError(error.message)}`);
  revalidatePath("/admin/paquetes");
  redirect("/admin/paquetes?universalSaved=extend");
}

export async function updateUniversalPackagePayment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = universalPackagePaymentSchema.safeParse({
    packageId: formData.get("packageId"),
    paymentStatus: formData.get("paymentStatus"),
  });
  if (!parsed.success) redirect("/admin/paquetes?universalError=invalid");
  const { error } = await supabase.rpc("update_service_package_payment", {
    requested_package_id: parsed.data.packageId,
    requested_payment_status: parsed.data.paymentStatus,
  });
  if (error) redirect(`/admin/paquetes?universalError=${universalPackageError(error.message)}`);
  revalidatePath("/admin");
  revalidatePath("/admin/paquetes");
  redirect("/admin/paquetes?universalSaved=payment");
}
