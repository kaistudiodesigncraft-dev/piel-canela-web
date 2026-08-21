"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";

const settingsSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  whatsappNumber: z.string().trim().max(30).optional(),
  address: z.string().trim().max(240).optional(),
  publicEmail: z.string().trim().email().max(180).optional(),
  instagramUrl: z.string().trim().url().max(500).optional(),
  minimumNoticeMinutes: z.coerce.number().int().min(0).max(10080),
  maximumAdvanceDays: z.coerce.number().int().min(1).max(365),
  pendingExpiryMinutes: z.coerce.number().int().min(15).max(1440),
  depositText: z.string().trim().max(1000).optional(),
  cancellationPolicy: z.string().trim().max(2000).optional(),
});

export async function saveBusinessSettings(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  const parsed = settingsSchema.safeParse({
    businessName: formData.get("businessName"),
    whatsappNumber: formData.get("whatsappNumber") || undefined,
    address: formData.get("address") || undefined,
    publicEmail: formData.get("publicEmail") || undefined,
    instagramUrl: formData.get("instagramUrl") || undefined,
    minimumNoticeMinutes: formData.get("minimumNoticeMinutes"),
    maximumAdvanceDays: formData.get("maximumAdvanceDays"),
    pendingExpiryMinutes: formData.get("pendingExpiryMinutes"),
    depositText: formData.get("depositText") || undefined,
    cancellationPolicy: formData.get("cancellationPolicy") || undefined,
  });
  if (!parsed.success) redirect("/admin/configuracion?settingsError=invalid#ajustes");
  const { error } = await supabase.from("business_settings").update({
    business_name: parsed.data.businessName,
    whatsapp_number: parsed.data.whatsappNumber || null,
    address: parsed.data.address || null,
    public_email: parsed.data.publicEmail || null,
    instagram_url: parsed.data.instagramUrl || null,
    minimum_notice_minutes: parsed.data.minimumNoticeMinutes,
    maximum_advance_days: parsed.data.maximumAdvanceDays,
    pending_expiry_minutes: parsed.data.pendingExpiryMinutes,
    deposit_text: parsed.data.depositText || null,
    cancellation_policy: parsed.data.cancellationPolicy || null,
    updated_by: userId,
  }).eq("singleton", true);
  if (error) redirect("/admin/configuracion?settingsError=save#ajustes");
  revalidatePath("/");
  revalidatePath("/reservar");
  revalidatePath("/admin/configuracion");
  redirect("/admin/configuracion?settingsSaved=1#ajustes");
}
