"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  SITE_CONTENT_DEFINITIONS,
  type SiteContentSection,
} from "@/domain/site-content";
import {
  clearAgencyUnlockSession,
  createAgencyUnlockSession,
  hasAgencyUnlockSession,
  verifyAgencyUnlockCode,
} from "@/lib/admin/agency-unlock";
import { requireAdmin } from "@/lib/admin/require-admin";

const sectionSchema = z.enum(["hero", "categories", "approach", "booking", "faq"]);
const codeSchema = z.string().trim().min(6).max(128);
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const imageExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function unlockContentEditor(formData: FormData) {
  const { userId } = await requireAdmin();
  const code = codeSchema.safeParse(formData.get("unlockCode"));
  if (!code.success || !verifyAgencyUnlockCode(code.data)) {
    redirect("/admin/contenido?unlockError=invalid");
  }

  await createAgencyUnlockSession(userId);
  redirect("/admin/contenido?unlocked=1");
}

export async function lockContentEditor() {
  await clearAgencyUnlockSession();
  redirect("/admin/contenido");
}

function validateText(kind: "short_text" | "long_text", value: FormDataEntryValue | null) {
  const maximum = kind === "short_text" ? 180 : 1400;
  return z.string().trim().min(1).max(maximum).safeParse(value);
}

export async function saveSiteContentSection(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  if (!(await hasAgencyUnlockSession(userId))) redirect("/admin/contenido?unlockError=expired");

  const sectionResult = sectionSchema.safeParse(formData.get("section"));
  if (!sectionResult.success) redirect("/admin/contenido?saveError=invalid");
  const section = sectionResult.data as SiteContentSection;
  const definitions = SITE_CONTENT_DEFINITIONS.filter((field) => field.section === section);

  for (const field of definitions) {
    if (field.kind === "image") {
      const alt = z.string().trim().min(3).max(240).safeParse(formData.get(`${field.key}_alt`));
      if (!alt.success) redirect(`/admin/contenido?saveError=imageAlt#${section}`);

      const file = formData.get(`${field.key}_file`);
      let imagePath: string | undefined;
      if (file instanceof File && file.size > 0) {
        if (file.size > 8 * 1024 * 1024 || !acceptedImageTypes.has(file.type)) {
          redirect(`/admin/contenido?saveError=image#${section}`);
        }
        imagePath = `${section}/${randomUUID()}.${imageExtension[file.type]}`;
        const { error: uploadError } = await supabase.storage
          .from("site-content-media")
          .upload(imagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) redirect(`/admin/contenido?saveError=upload#${section}`);
      }

      const update: Record<string, string> = {
        image_alt: alt.data,
        updated_by: userId,
      };
      if (imagePath) update.image_path = imagePath;
      const { error } = await supabase.from("site_content").update(update).eq("key", field.key);
      if (error) redirect(`/admin/contenido?saveError=database#${section}`);
      continue;
    }

    const value = validateText(field.kind, formData.get(field.key));
    if (!value.success) redirect(`/admin/contenido?saveError=text#${section}`);
    const { error } = await supabase
      .from("site_content")
      .update({ value: value.data, updated_by: userId })
      .eq("key", field.key);
    if (error) redirect(`/admin/contenido?saveError=database#${section}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/contenido");
  redirect(`/admin/contenido?saved=${section}#${section}`);
}
