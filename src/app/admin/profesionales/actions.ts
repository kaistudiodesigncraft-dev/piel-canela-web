"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  isTreatmentDeleteCodeConfigured,
  verifyTreatmentDeleteCode,
} from "@/lib/admin/treatment-delete-code";

const professionalSchema = z.object({
  professionalId: z.string().uuid().optional(),
  specialtyId: z.string().uuid(),
  specialtyIds: z.array(z.string().uuid()).default([]),
  fullName: z.string().trim().min(2).max(100),
  publicName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  bio: z.string().trim().max(1400).optional(),
  internalNotes: z.string().trim().max(1400).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999),
});

const deleteProfessionalSchema = z.object({
  professionalId: z.string().uuid(),
  confirmationCode: z.string().trim().min(4).max(128),
  confirmDeletion: z.literal("on"),
});

function professionalRedirect(params: string): never {
  redirect(`/admin/profesionales?${params}#equipo`);
}

export async function saveProfessional(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = professionalSchema.safeParse({
    professionalId: formData.get("professionalId") || undefined,
    specialtyId: formData.get("specialtyId"),
    specialtyIds: formData.getAll("specialtyIds"),
    fullName: formData.get("fullName"),
    publicName: formData.get("publicName") || undefined,
    phone: formData.get("phone") || undefined,
    bio: formData.get("bio") || undefined,
    internalNotes: formData.get("internalNotes") || undefined,
    displayOrder: formData.get("displayOrder"),
  });
  if (!parsed.success) professionalRedirect("professionalError=invalid");
  const specialtyIds = [...new Set([parsed.data.specialtyId, ...parsed.data.specialtyIds])];

  const isActive = formData.get("isActive") === "on";
  const { data: specialties } = await supabase.from("specialties")
    .select("id,is_active").in("id", specialtyIds);
  if ((specialties ?? []).filter((item) => item.is_active).length !== specialtyIds.length) professionalRedirect("professionalError=specialty");

  let assignedTreatments = 0;
  if (parsed.data.professionalId) {
    const [{ data: existing }, { count }] = await Promise.all([
      supabase.from("professionals").select("specialty_id,is_active")
        .eq("id", parsed.data.professionalId).single(),
      supabase.from("treatment_professionals").select("treatment_id", { count: "exact", head: true })
        .eq("professional_id", parsed.data.professionalId)
        .eq("is_active", true),
    ]);
    if (!existing) professionalRedirect("professionalError=missing");
    assignedTreatments = count ?? 0;
    if (existing.is_active && !isActive && assignedTreatments > 0 && formData.get("confirmImpact") !== "on") {
      professionalRedirect("professionalError=impact");
    }
  }

  const payload = {
    specialty_id: parsed.data.specialtyId,
    full_name: parsed.data.fullName,
    public_name: parsed.data.publicName || null,
    phone: parsed.data.phone || null,
    bio: parsed.data.bio || null,
    internal_notes: parsed.data.internalNotes || null,
    is_active: isActive,
    display_order: parsed.data.displayOrder,
  };
  const result = parsed.data.professionalId
    ? await supabase.from("professionals").update(payload).eq("id", parsed.data.professionalId).select("id").single()
    : await supabase.from("professionals").insert(payload).select("id").single();
  if (result.error) {
    professionalRedirect(`professionalError=${result.error.code === "23505" ? "duplicate" : "save"}`);
  }
  const professionalId = result.data.id;
  await supabase.from("professional_specialties").delete().eq("professional_id", professionalId);
  const specialtyResult = await supabase.from("professional_specialties").insert(
    specialtyIds.map((specialtyId) => ({ professional_id: professionalId, specialty_id: specialtyId })),
  );
  if (specialtyResult.error) professionalRedirect("professionalError=save");

  revalidatePath("/tratamientos");
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/profesionales");
  professionalRedirect("professionalSaved=1");
}

export async function deleteProfessional(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = deleteProfessionalSchema.safeParse({
    professionalId: formData.get("professionalId"),
    confirmationCode: formData.get("confirmationCode"),
    confirmDeletion: formData.get("confirmDeletion"),
  });
  if (!parsed.success) professionalRedirect("professionalError=deleteConfirmation");
  if (!isTreatmentDeleteCodeConfigured()) professionalRedirect("professionalError=deleteNotConfigured");

  const attempt = await supabase.rpc("register_admin_protected_action_attempt", {
    requested_action: "delete_professional",
  });
  if (attempt.error || attempt.data !== true) professionalRedirect("professionalError=deleteRateLimited");
  if (!verifyTreatmentDeleteCode(parsed.data.confirmationCode)) professionalRedirect("professionalError=deleteCode");

  const guardSecret = process.env.BOOKING_GUARD_SECRET;
  if (!guardSecret || guardSecret.length < 32) professionalRedirect("professionalError=deleteNotConfigured");

  const { error } = await supabase.rpc("delete_professional_if_unlinked", {
    requested_professional_id: parsed.data.professionalId,
    request_guard_secret: guardSecret,
  });
  if (error) {
    professionalRedirect(`professionalError=${error.code === "23503" ? "deleteLinked" : error.code === "P0002" ? "missing" : error.code === "42501" ? "deleteNotConfigured" : "deleteFailed"}`);
  }

  await supabase.rpc("clear_admin_protected_action_attempts", {
    requested_action: "delete_professional",
  });
  revalidatePath("/admin");
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/profesionales");
  revalidatePath("/tratamientos");
  professionalRedirect("professionalDeleted=1");
}
