"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pesosToCents, slugifySpecialty } from "@/lib/admin/operations";
import {
  OCCUPYING_BOOKING_STATUSES,
  percentageToFocalPoint,
  splitAdminLines,
} from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/admin/require-admin";

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const imageExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const treatmentSchema = z.object({
  treatmentId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  specialtyId: z.string().uuid(),
  professionalId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().min(10).max(240),
  description: z.string().trim().min(20).max(3000),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(180),
  pricePesos: z.coerce.number().int().min(0),
  preparation: z.string().trim().max(1400).optional(),
  contraindications: z.string().trim().max(1400).optional(),
  imageAlt: z.string().trim().max(240).optional(),
  focalX: z.coerce.number().min(0).max(100),
  focalY: z.coerce.number().min(0).max(100),
  displayOrder: z.coerce.number().int().min(0).max(999),
});

const categorySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  shortDescription: z.string().trim().min(10).max(240),
});

function catalogRedirect(params: string, anchor = "tratamientos"): never {
  redirect(`/admin/catalogo?${params}#${anchor}`);
}

export async function saveTreatment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = treatmentSchema.safeParse({
    treatmentId: formData.get("treatmentId") || undefined,
    categoryId: formData.get("categoryId"),
    specialtyId: formData.get("specialtyId"),
    professionalId: formData.get("professionalId") || undefined,
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    durationMinutes: formData.get("durationMinutes"),
    bufferMinutes: formData.get("bufferMinutes"),
    pricePesos: formData.get("pricePesos"),
    preparation: formData.get("preparation") || undefined,
    contraindications: formData.get("contraindications") || undefined,
    imageAlt: formData.get("imageAlt") || undefined,
    focalX: formData.get("focalX"),
    focalY: formData.get("focalY"),
    displayOrder: formData.get("displayOrder"),
  });
  if (!parsed.success) catalogRedirect("treatmentError=invalid");

  const expectations = splitAdminLines(String(formData.get("expectations") ?? ""), 8);
  const characteristics = splitAdminLines(String(formData.get("characteristics") ?? ""), 3);
  if (expectations.some((item) => item.length > 180) || characteristics.some((item) => item.length > 80)) {
    catalogRedirect("treatmentError=lists");
  }

  const isActive = formData.get("isActive") === "on";
  const id = parsed.data.treatmentId ?? randomUUID();
  const [{ data: category }, { data: specialty }] = await Promise.all([
    supabase.from("treatment_categories").select("id,is_active").eq("id", parsed.data.categoryId).single(),
    supabase.from("specialties").select("id,is_active").eq("id", parsed.data.specialtyId).single(),
  ]);
  if (!category?.is_active || !specialty?.is_active) catalogRedirect("treatmentError=taxonomy");

  if (parsed.data.professionalId) {
    const { data: professional } = await supabase.from("professionals")
      .select("id,specialty_id,is_active").eq("id", parsed.data.professionalId).single();
    if (!professional || professional.specialty_id !== parsed.data.specialtyId || (isActive && !professional.is_active)) {
      catalogRedirect("treatmentError=professional");
    }
  }

  let existing: {
    slug: string;
    image_path: string | null;
    duration_minutes: number;
    buffer_minutes: number;
    is_active: boolean;
  } | null = null;
  let futureBookings = 0;
  if (parsed.data.treatmentId) {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("treatments")
        .select("slug,image_path,duration_minutes,buffer_minutes,is_active")
        .eq("id", id).single(),
      supabase.from("bookings").select("id", { count: "exact", head: true })
        .eq("treatment_id", id)
        .in("status", [...OCCUPYING_BOOKING_STATUSES])
        .gte("starts_at", new Date().toISOString()),
    ]);
    existing = data;
    futureBookings = count ?? 0;
    if (!existing) catalogRedirect("treatmentError=missing");
    const affectsAgenda = existing.duration_minutes !== parsed.data.durationMinutes
      || existing.buffer_minutes !== parsed.data.bufferMinutes
      || (existing.is_active && !isActive);
    if (affectsAgenda && futureBookings > 0 && formData.get("confirmImpact") !== "on") {
      catalogRedirect(`treatmentError=impact&treatment=${id}`);
    }
  }

  let imagePath = existing?.image_path ?? null;
  const imageFile = formData.get("imageFile");
  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > 8 * 1024 * 1024 || !acceptedImageTypes.has(imageFile.type)) {
      catalogRedirect("treatmentError=image");
    }
    imagePath = `treatments/${id}/${randomUUID()}.${imageExtension[imageFile.type]}`;
    const { error: uploadError } = await supabase.storage.from("treatment-media")
      .upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) catalogRedirect("treatmentError=upload");
  }
  if (isActive && (!imagePath || !parsed.data.imageAlt)) catalogRedirect("treatmentError=publishable");

  const payload = {
    category_id: parsed.data.categoryId,
    specialty_id: parsed.data.specialtyId,
    professional_id: parsed.data.professionalId ?? null,
    name: parsed.data.name,
    slug: existing?.slug ?? slugifySpecialty(parsed.data.name),
    short_description: parsed.data.shortDescription,
    description: parsed.data.description,
    expectations,
    characteristics,
    duration_minutes: parsed.data.durationMinutes,
    buffer_minutes: parsed.data.bufferMinutes,
    price_cents: pesosToCents(parsed.data.pricePesos),
    preparation: parsed.data.preparation || null,
    contraindications: parsed.data.contraindications || null,
    image_path: imagePath,
    image_alt: parsed.data.imageAlt || null,
    image_focal_x: percentageToFocalPoint(parsed.data.focalX),
    image_focal_y: percentageToFocalPoint(parsed.data.focalY),
    is_active: isActive,
    display_order: parsed.data.displayOrder,
  };
  if (!payload.slug) catalogRedirect("treatmentError=invalid");

  const result = parsed.data.treatmentId
    ? await supabase.from("treatments").update(payload).eq("id", id)
    : await supabase.from("treatments").insert({ id, ...payload });
  if (result.error) {
    const reason = result.error.code === "23505" ? "duplicate" : "save";
    catalogRedirect(`treatmentError=${reason}`);
  }

  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath(`/tratamientos/${payload.slug}`);
  revalidatePath("/reservar");
  revalidatePath("/admin");
  revalidatePath("/admin/catalogo");
  catalogRedirect(`treatmentSaved=1&treatment=${id}`);
}

export async function updateTreatmentCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) catalogRedirect("categoryError=invalid", "categorias");
  const { error } = await supabase.from("treatment_categories").update({
    name: parsed.data.name,
    short_description: parsed.data.shortDescription,
  }).eq("id", parsed.data.categoryId);
  if (error) catalogRedirect("categoryError=save", "categorias");
  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath("/admin/catalogo");
  catalogRedirect("categorySaved=1", "categorias");
}

