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
import { inspectAdminImage } from "@/lib/admin/image-upload";
import { requireAdmin } from "@/lib/admin/require-admin";

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

export interface SaveTreatmentState {
  status: "idle" | "error";
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const initialSaveTreatmentState: SaveTreatmentState = { status: "idle" };

function treatmentFailure(error: string, fieldErrors?: Record<string, string>): SaveTreatmentState {
  return { status: "error", error, fieldErrors };
}

function schemaFieldErrors(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (field && !fields[field]) fields[field] = "Revisá este dato antes de guardar.";
  }
  return fields;
}

function catalogRedirect(params: string, anchor = "tratamientos"): never {
  redirect(`/admin/catalogo?${params}#${anchor}`);
}

export async function saveTreatment(
  _previousState: SaveTreatmentState,
  formData: FormData,
): Promise<SaveTreatmentState> {
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
  if (!parsed.success) return treatmentFailure("invalid", schemaFieldErrors(parsed.error));

  const expectations = splitAdminLines(String(formData.get("expectations") ?? ""), 8);
  const characteristics = splitAdminLines(String(formData.get("characteristics") ?? ""), 3);
  if (expectations.some((item) => item.length > 180) || characteristics.some((item) => item.length > 80)) {
    return treatmentFailure("lists", {
      ...(expectations.some((item) => item.length > 180) ? { expectations: "Cada expectativa puede tener hasta 180 caracteres." } : {}),
      ...(characteristics.some((item) => item.length > 80) ? { characteristics: "Cada característica puede tener hasta 80 caracteres." } : {}),
    });
  }

  const isActive = formData.get("isActive") === "on";
  const id = parsed.data.treatmentId ?? randomUUID();
  const [{ data: category }, { data: specialty }] = await Promise.all([
    supabase.from("treatment_categories").select("id,is_active").eq("id", parsed.data.categoryId).single(),
    supabase.from("specialties").select("id,is_active").eq("id", parsed.data.specialtyId).single(),
  ]);
  if (!category?.is_active || !specialty?.is_active) {
    return treatmentFailure("taxonomy", {
      ...(!category?.is_active ? { categoryId: "Elegí una categoría activa." } : {}),
      ...(!specialty?.is_active ? { specialtyId: "Elegí una especialidad activa." } : {}),
    });
  }

  if (parsed.data.professionalId) {
    const { data: professional } = await supabase.from("professionals")
      .select("id,specialty_id,is_active").eq("id", parsed.data.professionalId).single();
    if (!professional || professional.specialty_id !== parsed.data.specialtyId || (isActive && !professional.is_active)) {
      return treatmentFailure("professional", { professionalId: "Elegí un profesional activo de esta especialidad." });
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
    if (!existing) return treatmentFailure("missing");
    const affectsAgenda = existing.duration_minutes !== parsed.data.durationMinutes
      || existing.buffer_minutes !== parsed.data.bufferMinutes
      || (existing.is_active && !isActive);
    if (affectsAgenda && futureBookings > 0 && formData.get("confirmImpact") !== "on") {
      return treatmentFailure("impact", { confirmImpact: "Confirmá el impacto sobre las reservas futuras para continuar." });
    }
  }

  let imagePath = existing?.image_path ?? null;
  let uploadedImagePath: string | null = null;
  const imageFile = formData.get("imageFile");
  const hasNewImage = imageFile instanceof File && imageFile.size > 0;
  if (isActive) {
    const publicationErrors: Record<string, string> = {};
    if (!imagePath && !hasNewImage) publicationErrors.imageFile = "Cargá una imagen antes de publicar.";
    if (!parsed.data.imageAlt || parsed.data.imageAlt.length < 3) publicationErrors.imageAlt = "Describí la imagen con al menos 3 caracteres.";
    if (parsed.data.pricePesos <= 0) publicationErrors.pricePesos = "Ingresá un precio mayor que cero para publicar.";
    if (Object.keys(publicationErrors).length > 0) return treatmentFailure("publishable", publicationErrors);
  }
  if (hasNewImage) {
    const inspection = await inspectAdminImage(imageFile);
    if (!inspection.valid) {
      const reason = inspection.error === "too-small" || inspection.error === "too-large" || inspection.error === "dimensions"
        ? "image-dimensions"
        : "image";
      return treatmentFailure(reason, {
        imageFile: inspection.error === "too-small"
          ? "La imagen debe tener al menos 640 × 640 píxeles."
          : inspection.error === "too-large"
            ? "La imagen supera los 40 megapíxeles permitidos."
            : inspection.error === "dimensions"
              ? "No pudimos leer las dimensiones de la imagen."
              : "Usá una imagen JPG, PNG, WebP o AVIF válida de hasta 8 MB.",
      });
    }
    imagePath = `treatments/${id}/${randomUUID()}.${imageExtension[imageFile.type]}`;
    uploadedImagePath = imagePath;
    const { error: uploadError } = await supabase.storage.from("treatment-media")
      .upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });
    if (uploadError) {
      await supabase.storage.from("treatment-media").remove([imagePath]);
      return treatmentFailure("upload", { imageFile: "La imagen no pudo cargarse. Intentá nuevamente." });
    }
  }

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
  if (!payload.slug) {
    if (uploadedImagePath) await supabase.storage.from("treatment-media").remove([uploadedImagePath]);
    return treatmentFailure("invalid", { name: "El nombre debe contener letras o números para crear la URL." });
  }

  const result = parsed.data.treatmentId
    ? await supabase.from("treatments").update(payload).eq("id", id)
    : await supabase.from("treatments").insert({ id, ...payload });
  if (result.error) {
    if (uploadedImagePath) await supabase.storage.from("treatment-media").remove([uploadedImagePath]);
    const reason = result.error.code === "23505" ? "duplicate" : "save";
    return treatmentFailure(reason, reason === "duplicate" ? { name: "Ya existe un tratamiento con esta URL." } : undefined);
  }

  if (uploadedImagePath && existing?.image_path && existing.image_path !== uploadedImagePath
    && !existing.image_path.startsWith("/") && !existing.image_path.startsWith("https://")) {
    await supabase.storage.from("treatment-media").remove([existing.image_path]);
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
