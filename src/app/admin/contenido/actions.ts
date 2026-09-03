"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  isSiteContentKey,
  SITE_CONTENT_DEFINITIONS,
  type SiteContentKey,
  type SiteContentSection,
} from "@/domain/site-content";
import {
  ADMIN_IMAGE_MAX_BYTES,
  ADMIN_IMAGE_TYPES,
  inspectAdminImage,
} from "@/lib/admin/image-upload";
import { requireAdmin } from "@/lib/admin/require-admin";

const sectionSchema = z.enum([
  "hero", "categories", "specials", "approach", "booking", "faq",
  "catalog_header", "booking_header",
]);
const intentSchema = z.enum(["draft", "publish"]);
const surfaceSchema = z.enum(["plain", "soft", "contrast"]);
const overlaySchema = z.enum(["none", "light", "medium", "strong"]);
const safeTextSchema = (maximum: number) => z.string().trim().min(1).max(maximum)
  .refine((value) => !/<[^>]*>/.test(value), "No se admite HTML.");
const imageExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export interface SiteContentEditorState {
  status: "idle" | "invalid" | "saved" | "published" | "failed";
  section?: SiteContentSection;
  fieldErrors: Record<string, string[]>;
  incidentId?: string;
  message?: string;
}

export interface MediaUploadIntent {
  id: string;
  path: string;
  token: string;
  expiresAt: string;
}

type MediaActionResult = { ok: true; intent: MediaUploadIntent } | { ok: false; error: string };
type FinalizeMediaResult = { ok: true; imagePath: string; publicUrl: string } | { ok: false; error: string };

function incidentId() {
  return randomUUID().split("-")[0]?.toUpperCase() ?? "UNKNOWN";
}

function imageDefinition(key: string) {
  return isSiteContentKey(key)
    ? SITE_CONTENT_DEFINITIONS.find((field) => field.key === key && field.kind === "image")
    : undefined;
}

export async function createSiteContentMediaUploadIntent(input: {
  key: string;
  section: string;
  mimeType: string;
  size: number;
}): Promise<MediaActionResult> {
  const { supabase, userId } = await requireAdmin();
  const section = sectionSchema.safeParse(input.section);
  const definition = imageDefinition(input.key);
  if (!section.success || !definition || definition.section !== section.data) {
    return { ok: false, error: "El espacio visual no es válido." };
  }
  if (!ADMIN_IMAGE_TYPES.has(input.mimeType) || input.size < 1 || input.size > ADMIN_IMAGE_MAX_BYTES) {
    return { ok: false, error: "La imagen debe ser JPG, PNG, WebP o AVIF y pesar hasta 4 MB." };
  }

  const id = randomUUID();
  const path = `${userId}/${section.data}/${id}.${imageExtension[input.mimeType]}`;
  const { data, error } = await supabase.storage.from("site-content-media-ingest").createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la carga de la imagen." };

  return {
    ok: true,
    intent: { id, path, token: data.token, expiresAt: new Date(Date.now() + 90_000).toISOString() },
  };
}

export async function finalizeSiteContentMediaUpload(input: {
  key: string;
  section: string;
  ingestPath: string;
  mimeType: string;
}): Promise<FinalizeMediaResult> {
  const { supabase, userId } = await requireAdmin();
  const section = sectionSchema.safeParse(input.section);
  const definition = imageDefinition(input.key);
  const expectedPrefix = `${userId}/${section.success ? section.data : "invalid"}/`;
  if (!section.success || !definition || definition.section !== section.data
    || !input.ingestPath.startsWith(expectedPrefix) || !ADMIN_IMAGE_TYPES.has(input.mimeType)) {
    return { ok: false, error: "La carga no pertenece a este espacio visual." };
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from("site-content-media-ingest").download(input.ingestPath);
  if (downloadError || !blob) return { ok: false, error: "No se pudo verificar la imagen cargada." };

  const file = new File([await blob.arrayBuffer()], "site-content", { type: input.mimeType });
  const inspection = await inspectAdminImage(file);
  if (!inspection.valid) {
    await supabase.storage.from("site-content-media-ingest").remove([input.ingestPath]);
    return { ok: false, error: "La imagen no es válida o no cumple las dimensiones requeridas." };
  }

  const imagePath = `drafts/${section.data}/${randomUUID()}.${imageExtension[input.mimeType]}`;
  const { error: uploadError } = await supabase.storage
    .from("site-content-media")
    .upload(imagePath, file, { contentType: input.mimeType, upsert: false });
  await supabase.storage.from("site-content-media-ingest").remove([input.ingestPath]);
  if (uploadError) return { ok: false, error: "La imagen se verificó, pero no pudo guardarse." };

  const publicUrl = supabase.storage.from("site-content-media").getPublicUrl(imagePath).data.publicUrl;
  return { ok: true, imagePath, publicUrl };
}

function buildDraftEntries(section: SiteContentSection, formData: FormData) {
  const definitions = SITE_CONTENT_DEFINITIONS.filter((field) => field.section === section);
  const entries: Array<Record<string, string | number | null>> = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const field of definitions) {
    if (field.kind !== "image") {
      const parsed = safeTextSchema(field.kind === "short_text" ? 180 : 1400).safeParse(formData.get(field.key));
      if (!parsed.success) {
        fieldErrors[field.key] = parsed.error.issues.map((issue) => issue.message);
        continue;
      }
      entries.push({ key: field.key, value: parsed.data });
      continue;
    }

    const imagePathValue = String(formData.get(`${field.key}_image_path`) ?? "").trim();
    const imagePath = imagePathValue || null;
    const altValue = String(formData.get(`${field.key}_alt`) ?? "").trim();
    const alt = field.settings.presentation === "background"
      ? z.string().max(240).safeParse(altValue)
      : z.string().min(3).max(240).safeParse(altValue);
    const focalX = z.coerce.number().int().min(0).max(100).safeParse(formData.get(`${field.key}_focal_x`));
    const focalY = z.coerce.number().int().min(0).max(100).safeParse(formData.get(`${field.key}_focal_y`));
    const surface = surfaceSchema.safeParse(formData.get(`${field.key}_surface`));
    const overlay = overlaySchema.safeParse(formData.get(`${field.key}_overlay`));
    if (!alt.success || !focalX.success || !focalY.success || !surface.success || !overlay.success) {
      fieldErrors[field.key] = ["Revisá la descripción, el encuadre y los ajustes visuales."];
      continue;
    }
    if (imagePath && !/^(drafts|published)\/[a-z0-9_-]+\/[a-f0-9-]+\.(jpg|png|webp|avif)$/.test(imagePath)
      && !/^\/images\/[a-zA-Z0-9_./-]+$/.test(imagePath)) {
      fieldErrors[field.key] = ["La referencia de imagen no es válida."];
      continue;
    }
    entries.push({
      key: field.key,
      value: field.value,
      image_path: imagePath,
      image_alt: alt.data,
      focal_x: focalX.data,
      focal_y: focalY.data,
      surface_preset: surface.data,
      overlay_preset: overlay.data,
    });
  }

  return { entries, fieldErrors };
}

export async function submitSiteContentSection(
  _previous: SiteContentEditorState,
  formData: FormData,
): Promise<SiteContentEditorState> {
  const { supabase } = await requireAdmin();
  const sectionResult = sectionSchema.safeParse(formData.get("section"));
  const intentResult = intentSchema.safeParse(formData.get("intent"));
  if (!sectionResult.success || !intentResult.success) {
    return { status: "invalid", fieldErrors: {}, message: "La sección o la acción no es válida." };
  }
  const section = sectionResult.data;
  const { entries, fieldErrors } = buildDraftEntries(section, formData);
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "invalid", section, fieldErrors, message: "Revisá los campos marcados." };
  }

  const incident = incidentId();
  const { error: draftError } = await supabase.rpc("save_site_content_draft", {
    p_section: section,
    p_entries: entries,
  });
  if (draftError) {
    console.error("site_content_draft_failed", { incidentId: incident, code: draftError.code, section });
    return { status: "failed", section, fieldErrors: {}, incidentId: incident, message: "No se pudo guardar el borrador." };
  }

  if (intentResult.data === "publish") {
    const { error: publishError } = await supabase.rpc("publish_site_content_section", { p_section: section });
    if (publishError) {
      console.error("site_content_publish_failed", { incidentId: incident, code: publishError.code, section });
      return { status: "failed", section, fieldErrors: {}, incidentId: incident, message: "El borrador quedó guardado, pero no pudo publicarse." };
    }
  }

  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath("/reservar");
  revalidatePath("/admin/contenido");
  return {
    status: intentResult.data === "publish" ? "published" : "saved",
    section,
    fieldErrors: {},
    message: intentResult.data === "publish" ? "La sección se publicó correctamente." : "Borrador guardado.",
  };
}

export async function restoreSiteContentRevision(formData: FormData) {
  const { supabase } = await requireAdmin();
  const revisionId = z.string().uuid().safeParse(formData.get("revisionId"));
  if (!revisionId.success) return;
  const { error } = await supabase.rpc("restore_site_content_revision", { p_revision_id: revisionId.data });
  if (error) throw new Error("No se pudo restaurar la revisión seleccionada.");
  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath("/reservar");
  revalidatePath("/admin/contenido");
}

export type { SiteContentKey };
