"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { inspectAdminImage } from "@/lib/admin/image-upload";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  TREATMENT_MEDIA_BUCKET,
  TREATMENT_MEDIA_INGEST_BUCKET,
  TREATMENT_MEDIA_OUTPUT_TYPE,
  type MediaUploadIntent,
} from "@/lib/admin/treatment-media";

const treatmentIdSchema = z.string().uuid();
const uploadIdSchema = z.string().uuid();

export type MediaIntentResult =
  | { ok: true; intent: MediaUploadIntent }
  | { ok: false; error: "invalid" | "create" | "sign"; incidentId: string };

export type MediaFinalizeResult =
  | { ok: true; imagePath: string; width: number; height: number }
  | { ok: false; error: "invalid" | "missing" | "expired" | "download" | "image" | "store" | "finalize"; incidentId: string };

function incidentId() {
  return randomUUID().slice(0, 8).toUpperCase();
}

export async function createTreatmentMediaUploadIntent(treatmentId: string): Promise<MediaIntentResult> {
  const incident = incidentId();
  const parsedTreatmentId = treatmentIdSchema.safeParse(treatmentId);
  if (!parsedTreatmentId.success) return { ok: false, error: "invalid", incidentId: incident };

  const { supabase, userId } = await requireAdmin();
  const id = randomUUID();
  const path = `${userId}/${id}.webp`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from("treatment_media_uploads").insert({
    id,
    user_id: userId,
    treatment_id: parsedTreatmentId.data,
    ingest_path: path,
    expires_at: expiresAt,
  });
  if (insertError) {
    console.error("treatment_media_intent_create", { incidentId: incident, code: insertError.code });
    return { ok: false, error: "create", incidentId: incident };
  }

  const { data, error } = await supabase.storage
    .from(TREATMENT_MEDIA_INGEST_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.token) {
    await supabase.from("treatment_media_uploads").update({
      status: "failed",
      failure_code: "sign",
    }).eq("id", id).eq("user_id", userId);
    console.error("treatment_media_intent_sign", { incidentId: incident, code: error?.name });
    return { ok: false, error: "sign", incidentId: incident };
  }

  return { ok: true, intent: { id, path, token: data.token, expiresAt } };
}

export async function finalizeTreatmentMediaUpload(uploadId: string): Promise<MediaFinalizeResult> {
  const incident = incidentId();
  const parsedUploadId = uploadIdSchema.safeParse(uploadId);
  if (!parsedUploadId.success) return { ok: false, error: "invalid", incidentId: incident };

  const { supabase, userId } = await requireAdmin();
  const { data: upload, error: uploadRecordError } = await supabase
    .from("treatment_media_uploads")
    .select("id,treatment_id,ingest_path,final_path,status,expires_at,width,height")
    .eq("id", parsedUploadId.data)
    .eq("user_id", userId)
    .single();
  if (uploadRecordError || !upload) return { ok: false, error: "missing", incidentId: incident };
  if (upload.status === "finalized" && upload.final_path && upload.width && upload.height) {
    return { ok: true, imagePath: upload.final_path, width: upload.width, height: upload.height };
  }
  if (new Date(upload.expires_at).getTime() <= Date.now()) {
    await supabase.from("treatment_media_uploads").update({ status: "failed", failure_code: "expired" })
      .eq("id", upload.id).eq("user_id", userId);
    return { ok: false, error: "expired", incidentId: incident };
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(TREATMENT_MEDIA_INGEST_BUCKET)
    .download(upload.ingest_path);
  if (downloadError || !downloaded) {
    console.error("treatment_media_download", { incidentId: incident, code: downloadError?.name });
    return { ok: false, error: "download", incidentId: incident };
  }
  const file = new File([downloaded], "normalized-treatment.webp", { type: TREATMENT_MEDIA_OUTPUT_TYPE });
  const inspection = await inspectAdminImage(file);
  if (!inspection.valid) {
    await supabase.from("treatment_media_uploads").update({
      status: "failed",
      failure_code: `image_${inspection.error}`,
    }).eq("id", upload.id).eq("user_id", userId);
    return { ok: false, error: "image", incidentId: incident };
  }

  const finalPath = `treatments/${upload.treatment_id}/${upload.id}.webp`;
  const { error: storeError } = await supabase.storage.from(TREATMENT_MEDIA_BUCKET).upload(
    finalPath,
    downloaded,
    { contentType: TREATMENT_MEDIA_OUTPUT_TYPE, upsert: false, cacheControl: "31536000" },
  );
  const isAlreadyStored = Boolean(storeError?.message.match(/already exists|duplicate/i));
  if (storeError && !isAlreadyStored) {
    console.error("treatment_media_store", { incidentId: incident, code: storeError.name });
    return { ok: false, error: "store", incidentId: incident };
  }

  const { error: finalizeError } = await supabase.from("treatment_media_uploads").update({
    status: "finalized",
    final_path: finalPath,
    mime_type: TREATMENT_MEDIA_OUTPUT_TYPE,
    byte_size: downloaded.size,
    width: inspection.width,
    height: inspection.height,
    failure_code: null,
    finalized_at: new Date().toISOString(),
  }).eq("id", upload.id).eq("user_id", userId);
  if (finalizeError) {
    console.error("treatment_media_finalize", { incidentId: incident, code: finalizeError.code });
    return { ok: false, error: "finalize", incidentId: incident };
  }

  // Final media is durable before this best-effort cleanup. A failed cleanup can
  // never break an already saved treatment or its previous image.
  await supabase.storage.from(TREATMENT_MEDIA_INGEST_BUCKET).remove([upload.ingest_path]);
  return { ok: true, imagePath: finalPath, width: inspection.width, height: inspection.height };
}
