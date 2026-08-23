"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  argentinaLocalDateTimeToIso,
  pesosToCents,
  slugifySpecialty,
} from "@/lib/admin/operations";
import { ADMIN_IMAGE_TYPES, hasExpectedImageSignature } from "@/lib/admin/image-upload";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const availabilityRuleSchema = z.object({
  specialtyId: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120),
});
const specialtySchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
});
const bookingStatusSchema = z.enum([
  "pending", "awaiting_deposit", "confirmed", "completed", "cancelled", "no_show", "expired",
]);
const initialBookingStatusSchema = z.enum(["pending", "awaiting_deposit", "confirmed"]);
const manualBookingSchema = z.object({
  treatmentId: z.string().uuid(),
  monthlySpecialId: z.string().uuid().optional(),
  startsAt: z.string(),
  status: initialBookingStatusSchema,
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(180).optional(),
  customerNotes: z.string().trim().max(240).optional(),
  internalNotes: z.string().trim().max(1000).optional(),
});
const availabilityExceptionSchema = z.object({
  specialtyId: z.string().uuid(),
  kind: z.enum(["open", "blocked"]),
  startsAt: z.string(),
  endsAt: z.string(),
  publicReason: z.string().trim().max(180).optional(),
  internalReason: z.string().trim().max(500).optional(),
});
const monthlySpecialSchema = z.object({
  specialId: z.string().uuid().optional(),
  treatmentId: z.string().uuid(),
  title: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().min(10).max(240),
  detail: z.string().trim().min(20).max(1400),
  imageAlt: z.string().trim().min(3).max(240),
  specialPricePesos: z.coerce.number().int().positive(),
  referencePricePesos: z.coerce.number().int().positive().optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  terms: z.string().trim().max(500).optional(),
  displayOrder: z.coerce.number().int().min(1).max(4),
});
const imageExtension: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
};

export async function signInAdmin(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/login?error=invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/admin/login?error=credentials");
  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function createSpecialty(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = specialtySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin?specialtyError=invalid#especialidades");
  const slug = slugifySpecialty(parsed.data.name);
  if (!slug) redirect("/admin?specialtyError=invalid#especialidades");
  const { data: last } = await supabase.from("specialties").select("display_order")
    .order("display_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("specialties").insert({
    name: parsed.data.name,
    slug,
    description: parsed.data.description,
    display_order: (last?.display_order ?? 0) + 1,
    is_active: formData.get("isActive") === "on",
  });
  if (error) redirect(`/admin?specialtyError=${error.code === "23505" ? "duplicate" : "save"}#especialidades`);
  revalidatePath("/admin");
  redirect("/admin?specialtySaved=1#especialidades");
}

export async function toggleSpecialty(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const isActive = z.enum(["true", "false"]).safeParse(formData.get("isActive"));
  if (!id.success || !isActive.success) redirect("/admin?specialtyError=invalid#especialidades");
  const { error } = await supabase.from("specialties")
    .update({ is_active: isActive.data === "true" }).eq("id", id.data);
  if (error) redirect("/admin?specialtyError=save#especialidades");
  revalidatePath("/admin");
  redirect("/admin?specialtySaved=1#especialidades");
}

export async function createAvailabilityRule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = availabilityRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.startTime >= parsed.data.endTime) {
    redirect("/admin?availabilityError=invalid#disponibilidad");
  }
  const { error } = await supabase.from("availability_rules").insert({
    specialty_id: parsed.data.specialtyId,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    slot_interval_minutes: parsed.data.slotIntervalMinutes,
  });
  if (error) redirect(`/admin?availabilityError=${error.code === "23505" ? "duplicate" : "save"}#disponibilidad`);
  revalidatePath("/admin");
  redirect("/admin?availabilitySaved=1#disponibilidad");
}

export async function deleteAvailabilityRule(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin?availabilityError=invalid#disponibilidad");
  const { error } = await supabase.from("availability_rules").update({ is_active: false }).eq("id", id.data);
  if (error) redirect("/admin?availabilityError=delete#disponibilidad");
  revalidatePath("/admin");
  redirect("/admin?availabilitySaved=1#disponibilidad");
}

export async function createAvailabilityException(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  const parsed = availabilityExceptionSchema.safeParse({
    specialtyId: formData.get("specialtyId"), kind: formData.get("kind"),
    startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"),
    publicReason: formData.get("publicReason") || undefined,
    internalReason: formData.get("internalReason") || undefined,
  });
  const startsAt = parsed.success ? argentinaLocalDateTimeToIso(parsed.data.startsAt) : null;
  const endsAt = parsed.success ? argentinaLocalDateTimeToIso(parsed.data.endsAt) : null;
  if (!parsed.success || !startsAt || !endsAt || startsAt >= endsAt) {
    redirect("/admin?exceptionError=invalid#excepciones");
  }
  const { error } = await supabase.from("availability_exceptions").insert({
    specialty_id: parsed.data.specialtyId, kind: parsed.data.kind,
    starts_at: startsAt, ends_at: endsAt,
    public_reason: parsed.data.publicReason || null,
    internal_reason: parsed.data.internalReason || null,
    created_by: userId,
  });
  if (error) redirect("/admin?exceptionError=save#excepciones");
  revalidatePath("/admin");
  redirect("/admin?exceptionSaved=1#excepciones");
}

export async function deleteAvailabilityException(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin?exceptionError=invalid#excepciones");
  const { error } = await supabase.from("availability_exceptions").delete().eq("id", id.data);
  if (error) redirect("/admin?exceptionError=delete#excepciones");
  revalidatePath("/admin");
  redirect("/admin?exceptionSaved=1#excepciones");
}

export async function createManualBooking(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = manualBookingSchema.safeParse({
    treatmentId: formData.get("treatmentId"),
    monthlySpecialId: formData.get("monthlySpecialId") || undefined,
    startsAt: formData.get("startsAt"), status: formData.get("status"),
    fullName: formData.get("fullName"), phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    customerNotes: formData.get("customerNotes") || undefined,
    internalNotes: formData.get("internalNotes") || undefined,
  });
  const startsAt = parsed.success ? argentinaLocalDateTimeToIso(parsed.data.startsAt) : null;
  if (!parsed.success || !startsAt) redirect("/admin?manualBookingError=invalid#asignar");
  const { error } = await supabase.rpc("create_admin_booking", {
    requested_treatment_id: parsed.data.treatmentId,
    requested_monthly_special_id: parsed.data.monthlySpecialId ?? null,
    requested_starts_at: startsAt,
    requested_status: parsed.data.status,
    requested_idempotency_key: randomUUID(),
    customer_full_name: parsed.data.fullName,
    customer_phone: parsed.data.phone,
    customer_email: parsed.data.email ?? "",
    customer_notes: parsed.data.customerNotes ?? "",
    internal_notes: parsed.data.internalNotes ?? "",
  });
  if (error) {
    const reason = error.message.includes("slot_not_available") ? "conflict" : "save";
    redirect(`/admin?manualBookingError=${reason}#asignar`);
  }
  revalidatePath("/admin");
  redirect("/admin?manualBookingSaved=1#asignar");
}

export async function updateBookingStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const bookingId = z.string().uuid().safeParse(formData.get("bookingId"));
  const nextStatus = bookingStatusSchema.safeParse(formData.get("status"));
  const reason = z.string().trim().max(500).optional().safeParse(formData.get("reason") || undefined);
  if (!bookingId.success || !nextStatus.success || !reason.success) redirect("/admin?bookingError=invalid#reservas");
  const { error } = await supabase.rpc("transition_admin_booking", {
    requested_booking_id: bookingId.data,
    requested_status: nextStatus.data,
    requested_reason: reason.data ?? null,
  });
  if (error) {
    const errorCode = error.message.includes("status_reason_required")
      ? "reason"
      : error.message.includes("invalid_status_transition")
        ? "transition"
        : "save";
    redirect(`/admin?bookingError=${errorCode}#reservas`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/seguridad");
  redirect("/admin?bookingSaved=1#reservas");
}

export async function saveMonthlySpecial(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  const parsed = monthlySpecialSchema.safeParse({
    specialId: formData.get("specialId") || undefined,
    treatmentId: formData.get("treatmentId"), title: formData.get("title"),
    shortDescription: formData.get("shortDescription"), detail: formData.get("detail"),
    imageAlt: formData.get("imageAlt"), specialPricePesos: formData.get("specialPricePesos"),
    referencePricePesos: formData.get("referencePricePesos") || undefined,
    startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"),
    terms: formData.get("terms") || undefined, displayOrder: formData.get("displayOrder"),
  });
  const startsAt = parsed.success ? argentinaLocalDateTimeToIso(parsed.data.startsAt) : null;
  const endsAt = parsed.success ? argentinaLocalDateTimeToIso(parsed.data.endsAt) : null;
  if (!parsed.success || !startsAt || !endsAt || startsAt >= endsAt) {
    redirect("/admin?specialError=invalid#especiales-mes");
  }
  const specialPrice = pesosToCents(parsed.data.specialPricePesos);
  const referencePrice = parsed.data.referencePricePesos ? pesosToCents(parsed.data.referencePricePesos) : null;
  if (referencePrice !== null && referencePrice <= specialPrice) {
    redirect("/admin?specialError=price#especiales-mes");
  }
  let imagePath: string | null = null;
  let previousImagePath: string | null = null;
  let uploadedImagePath: string | null = null;
  if (parsed.data.specialId) {
    const { data: current } = await supabase.from("monthly_specials")
      .select("image_path").eq("id", parsed.data.specialId).single();
    imagePath = current?.image_path ?? null;
    previousImagePath = imagePath;
  }
  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    if (file.size > 8 * 1024 * 1024 || !ADMIN_IMAGE_TYPES.has(file.type) || !(await hasExpectedImageSignature(file))) {
      redirect("/admin?specialError=image#especiales-mes");
    }
    imagePath = `specials/${randomUUID()}.${imageExtension[file.type]}`;
    uploadedImagePath = imagePath;
    const { error: uploadError } = await supabase.storage.from("treatment-media")
      .upload(imagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) redirect("/admin?specialError=upload#especiales-mes");
  }
  if (!imagePath) redirect("/admin?specialError=imageRequired#especiales-mes");
  const payload = {
    treatment_id: parsed.data.treatmentId,
    title: parsed.data.title,
    short_description: parsed.data.shortDescription,
    detail: parsed.data.detail,
    image_path: imagePath,
    image_alt: parsed.data.imageAlt,
    special_price_cents: specialPrice,
    reference_price_cents: referencePrice,
    starts_at: startsAt,
    ends_at: endsAt,
    terms: parsed.data.terms || null,
    is_active: formData.get("isActive") === "on",
    display_order: parsed.data.displayOrder,
  };
  const result = parsed.data.specialId
    ? await supabase.from("monthly_specials").update(payload).eq("id", parsed.data.specialId)
    : await supabase.from("monthly_specials").insert({ ...payload, created_by: userId });
  if (result.error) {
    if (uploadedImagePath) await supabase.storage.from("treatment-media").remove([uploadedImagePath]);
    redirect(`/admin?specialError=${result.error.code === "23P01" ? "overlap" : "save"}#especiales-mes`);
  }
  if (uploadedImagePath && previousImagePath && previousImagePath !== uploadedImagePath
    && !previousImagePath.startsWith("/") && !previousImagePath.startsWith("https://")) {
    await supabase.storage.from("treatment-media").remove([previousImagePath]);
  }
  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath("/admin");
  redirect("/admin?specialSaved=1#especiales-mes");
}
