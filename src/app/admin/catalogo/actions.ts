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
import {
  isTreatmentDeleteCodeConfigured,
  verifyTreatmentDeleteCode,
} from "@/lib/admin/treatment-delete-code";

const treatmentSchema = z.object({
  treatmentId: z.string().uuid(),
  categoryId: z.string().uuid(),
  specialtyId: z.string().uuid(),
  professionalId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().min(10).max(240),
  description: z.string().trim().min(20).max(3000),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  bufferMinutes: z.coerce.number().int().min(0).max(180),
  startIntervalMinutes: z.coerce.number().int().refine((value) => [15, 30, 60].includes(value)),
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

const deleteTreatmentSchema = z.object({
  treatmentId: z.string().uuid(),
  confirmationCode: z.string().trim().min(4).max(128),
  confirmDeletion: z.literal("on"),
});

export interface SaveTreatmentState {
  status: "idle" | "invalid" | "failed";
  error?: string;
  fieldErrors?: Record<string, string[]>;
  incidentId?: string;
}

export const initialSaveTreatmentState: SaveTreatmentState = { status: "idle" };

function newIncidentId() {
  return randomUUID().slice(0, 8).toUpperCase();
}

function treatmentFailure(error: string, fieldErrors?: Record<string, string[]>): SaveTreatmentState {
  const incidentId = newIncidentId();
  console.error("admin_treatment_mutation", {
    stage: error,
    incidentId,
    fieldKeys: fieldErrors ? Object.keys(fieldErrors) : [],
  });
  return {
    status: error === "save" || error === "missing" ? "failed" : "invalid",
    error,
    fieldErrors,
    incidentId,
  };
}

function operationalFailure(stage: string, code?: string): SaveTreatmentState {
  const incidentId = newIncidentId();
  console.error("admin_treatment_mutation", { stage, code: code ?? "unknown", incidentId });
  return { status: "failed", error: "save", incidentId };
}

function schemaFieldErrors(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (!field) continue;
    fields[field] ??= [];
    fields[field].push(issue.message);
  }
  return fields;
}

function catalogRedirect(params: string, anchor = "tratamientos"): never {
  redirect(`/admin/catalogo?${params}#${anchor}`);
}

function isNextRedirect(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export async function saveTreatment(
  previousState: SaveTreatmentState,
  formData: FormData,
): Promise<SaveTreatmentState> {
  try {
    return await saveTreatmentImpl(previousState, formData);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const incidentId = newIncidentId();
    const errorName = error instanceof Error ? error.name : "unknown";
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("admin_treatment_mutation_unexpected", {
      incidentId,
      errorName,
      errorMessage,
    });
    return { status: "failed", error: "unexpected", incidentId };
  }
}

async function saveTreatmentImpl(
  _previousState: SaveTreatmentState,
  formData: FormData,
): Promise<SaveTreatmentState> {
  const { supabase, userId } = await requireAdmin();
  const parsed = treatmentSchema.safeParse({
    treatmentId: formData.get("treatmentId"),
    categoryId: formData.get("categoryId"),
    specialtyId: formData.get("specialtyId"),
    professionalId: formData.get("professionalId") || undefined,
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    durationMinutes: formData.get("durationMinutes"),
    bufferMinutes: formData.get("bufferMinutes"),
    startIntervalMinutes: formData.get("startIntervalMinutes"),
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
      ...(expectations.some((item) => item.length > 180) ? { expectations: ["Cada expectativa puede tener hasta 180 caracteres."] } : {}),
      ...(characteristics.some((item) => item.length > 80) ? { characteristics: ["Cada característica puede tener hasta 80 caracteres."] } : {}),
    });
  }

  const submitIntent = formData.get("submitIntent") === "publish" ? "publish" : "draft";
  const isActive = submitIntent === "publish";
  const isNew = formData.get("isNew") === "true";
  const id = parsed.data.treatmentId;
  const [{ data: category }, { data: specialty }] = await Promise.all([
    supabase.from("treatment_categories").select("id,is_active").eq("id", parsed.data.categoryId).single(),
    supabase.from("specialties").select("id,is_active").eq("id", parsed.data.specialtyId).single(),
  ]);
  if (!category?.is_active || !specialty?.is_active) {
    return treatmentFailure("taxonomy", {
      ...(!category?.is_active ? { categoryId: ["Elegí una categoría activa."] } : {}),
      ...(!specialty?.is_active ? { specialtyId: ["Elegí una especialidad activa."] } : {}),
    });
  }

  if (parsed.data.professionalId) {
    const { data: professional } = await supabase.from("professionals")
      .select("id,specialty_id,is_active").eq("id", parsed.data.professionalId).single();
    if (!professional || professional.specialty_id !== parsed.data.specialtyId || (isActive && !professional.is_active)) {
      return treatmentFailure("professional", { professionalId: ["Elegí un profesional activo de esta especialidad."] });
    }
  }

  let existing: {
    slug: string;
    image_path: string | null;
    specialty_id: string;
    duration_minutes: number;
    buffer_minutes: number;
    start_interval_minutes: number;
    is_active: boolean;
  } | null = null;
  let futureBookings = 0;
  if (!isNew) {
    const treatmentResult = await supabase.from("treatments")
      .select("slug,image_path,specialty_id,duration_minutes,buffer_minutes,start_interval_minutes,is_active")
      .eq("id", id).single();
    existing = treatmentResult.data;
    if (treatmentResult.error && treatmentResult.error.code !== "PGRST116") {
      return operationalFailure("load_existing", treatmentResult.error.code);
    }
    if (!existing) return treatmentFailure("missing");
    const affectsAgenda = existing.duration_minutes !== parsed.data.durationMinutes
      || existing.buffer_minutes !== parsed.data.bufferMinutes
      || existing.start_interval_minutes !== parsed.data.startIntervalMinutes
      || existing.specialty_id !== parsed.data.specialtyId
      || (existing.is_active && !isActive);
    if (affectsAgenda) {
      const bookingsResult = await supabase.from("bookings").select("id", { count: "exact", head: true })
        .eq("treatment_id", id)
        .in("status", [...OCCUPYING_BOOKING_STATUSES])
        .gte("starts_at", new Date().toISOString());
      if (bookingsResult.error) return operationalFailure("load_booking_impact", bookingsResult.error.code);
      futureBookings = bookingsResult.count ?? 0;
      if (futureBookings > 0 && formData.get("confirmImpact") !== "on") {
        return treatmentFailure("impact", { confirmImpact: ["Confirmá el impacto sobre las reservas futuras para continuar."] });
      }
    }
  }

  const submittedImagePath = String(formData.get("imagePath") ?? "").trim() || null;
  let imagePath = existing?.image_path ?? null;
  if (submittedImagePath && submittedImagePath !== existing?.image_path) {
    const { data: finalizedUpload } = await supabase.from("treatment_media_uploads")
      .select("id,final_path,status")
      .eq("user_id", userId)
      .eq("treatment_id", id)
      .eq("final_path", submittedImagePath)
      .eq("status", "finalized")
      .single();
    if (!finalizedUpload) {
      return treatmentFailure("image", { imagePath: ["La carga no pudo verificarse. Volvé a seleccionar la imagen."] });
    }
    imagePath = finalizedUpload.final_path;
  }
  if (isActive) {
    const publicationErrors: Record<string, string[]> = {};
    if (!imagePath) publicationErrors.imagePath = ["Cargá una imagen antes de publicar."];
    if (!parsed.data.imageAlt || parsed.data.imageAlt.length < 3) publicationErrors.imageAlt = ["Describí la imagen con al menos 3 caracteres."];
    if (parsed.data.pricePesos <= 0) publicationErrors.pricePesos = ["Ingresá un precio mayor que cero para publicar."];
    if (Object.keys(publicationErrors).length > 0) return treatmentFailure("publishable", publicationErrors);
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
    start_interval_minutes: parsed.data.startIntervalMinutes,
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
    return treatmentFailure("invalid", { name: ["El nombre debe contener letras o números para crear la URL."] });
  }

  const result = isNew
    ? await supabase.from("treatments").insert({ id, ...payload })
    : await supabase.from("treatments").update(payload).eq("id", id);
  if (result.error) {
    if (isNew && result.error.code === "23505") {
      const { data: duplicateSubmission } = await supabase.from("treatments").select("id").eq("id", id).maybeSingle();
      if (duplicateSubmission) redirect(`/admin/catalogo/${id}?saved=1`);
    }
    const reason = result.error.code === "23505" ? "duplicate" : "save";
    if (reason === "save") return operationalFailure("save", result.error.code);
    return treatmentFailure(reason, { name: ["Ya existe un tratamiento con esta URL."] });
  }

  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath(`/tratamientos/${payload.slug}`);
  revalidatePath("/reservar");
  revalidatePath("/admin");
  revalidatePath("/admin/catalogo");
  redirect(`/admin/catalogo/${id}?${isActive ? "published" : "saved"}=1`);
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

export async function deleteTreatment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = deleteTreatmentSchema.safeParse({
    treatmentId: formData.get("treatmentId"),
    confirmationCode: formData.get("confirmationCode"),
    confirmDeletion: formData.get("confirmDeletion"),
  });
  if (!parsed.success) catalogRedirect("treatmentError=deleteConfirmation");
  if (!isTreatmentDeleteCodeConfigured()) catalogRedirect("treatmentError=deleteNotConfigured");
  if (!verifyTreatmentDeleteCode(parsed.data.confirmationCode)) catalogRedirect("treatmentError=deleteCode");

  const [treatmentResult, bookingResult, specialResult] = await Promise.all([
    supabase.from("treatments").select("id,slug,image_path").eq("id", parsed.data.treatmentId).single(),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("treatment_id", parsed.data.treatmentId),
    supabase.from("monthly_specials").select("id", { count: "exact", head: true }).eq("treatment_id", parsed.data.treatmentId),
  ]);
  const treatment = treatmentResult.data;
  if (!treatment) catalogRedirect("treatmentError=deleteMissing");
  if (bookingResult.error || specialResult.error) catalogRedirect("treatmentError=deleteFailed");
  if ((bookingResult.count ?? 0) > 0 || (specialResult.count ?? 0) > 0) {
    catalogRedirect("treatmentError=deleteLinked");
  }

  const { error } = await supabase.from("treatments").delete().eq("id", parsed.data.treatmentId);
  if (error) {
    catalogRedirect(`treatmentError=${error.code === "23503" ? "deleteLinked" : "deleteFailed"}`);
  }

  let mediaCleanupFailed = false;
  if (treatment.image_path && !treatment.image_path.startsWith("/") && !treatment.image_path.startsWith("https://")) {
    const [otherTreatments, otherSpecials] = await Promise.all([
      supabase.from("treatments").select("id", { count: "exact", head: true })
        .eq("image_path", treatment.image_path),
      supabase.from("monthly_specials").select("id", { count: "exact", head: true })
        .eq("image_path", treatment.image_path),
    ]);
    const referenceCheckFailed = Boolean(otherTreatments.error || otherSpecials.error);
    const isStillReferenced = (otherTreatments.count ?? 0) > 0 || (otherSpecials.count ?? 0) > 0;
    if (!referenceCheckFailed && !isStillReferenced) {
      const { error: mediaError } = await supabase.storage.from("treatment-media").remove([treatment.image_path]);
      mediaCleanupFailed = Boolean(mediaError);
    } else {
      // Retaining an unreferenced file is recoverable; deleting a referenced one is not.
      mediaCleanupFailed = referenceCheckFailed;
    }
  }

  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath(`/tratamientos/${treatment.slug}`);
  revalidatePath("/reservar");
  revalidatePath("/admin");
  revalidatePath("/admin/catalogo");
  catalogRedirect(`treatmentDeleted=1${mediaCleanupFailed ? "&mediaCleanup=failed" : ""}`);
}
