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
import { ADMIN_IMAGE_TYPES, hasExpectedImageSignature } from "@/lib/admin/image-upload";
import { requireOwner } from "@/lib/admin/require-admin";

const sectionSchema = z.enum(["hero", "categories", "approach", "booking", "faq"]);
const codeSchema = z.string().trim().min(6).max(128);
const imageExtension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function unlockContentEditor(formData: FormData) {
  const { userId } = await requireOwner();
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
  const { supabase, userId } = await requireOwner();
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
      let previousImagePath: string | null = null;
      if (file instanceof File && file.size > 0) {
        if (file.size > 8 * 1024 * 1024 || !ADMIN_IMAGE_TYPES.has(file.type) || !(await hasExpectedImageSignature(file))) {
          redirect(`/admin/contenido?saveError=image#${section}`);
        }
        imagePath = `${section}/${randomUUID()}.${imageExtension[file.type]}`;
        const { data: currentImage } = await supabase.from("site_content")
          .select("image_path").eq("key", field.key).single();
        previousImagePath = currentImage?.image_path ?? null;
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
      if (error) {
        if (imagePath) await supabase.storage.from("site-content-media").remove([imagePath]);
        redirect(`/admin/contenido?saveError=database#${section}`);
      }
      if (imagePath && previousImagePath && previousImagePath !== imagePath
        && !previousImagePath.startsWith("/") && !previousImagePath.startsWith("https://")) {
        await supabase.storage.from("site-content-media").remove([previousImagePath]);
      }
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
