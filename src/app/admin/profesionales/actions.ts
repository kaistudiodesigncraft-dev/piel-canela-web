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
  professionalId: z.string().uuid(),
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

export async function saveProfessional(_previous: { error?: string; saved?: boolean }, formData: FormData): Promise<{ error?: string; saved?: boolean }> {
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
  if (!parsed.success) return { error: "Revisá nombre, especialidades y orden. Los datos escritos se conservaron." };
  const specialtyIds = [...new Set([parsed.data.specialtyId, ...parsed.data.specialtyIds])];

  const isActive = formData.get("isActive") === "on";

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
  const result = await supabase.rpc("save_admin_professional", {
    requested_id: parsed.data.professionalId,
    payload,
    specialty_ids: specialtyIds,
    expected_updated_at: formData.get("expectedUpdatedAt") || null,
    confirm_impact: formData.get("confirmImpact") === "on",
  });
  if (result.error) {
    const messages: Record<string, string> = {
      stale_professional: "Otra persona actualizó este perfil. Copiá tus cambios y recargá antes de volver a guardar.",
      invalid_specialties: "Seleccioná especialidades activas.",
      specialty_in_use: "No podés retirar una especialidad con tratamientos asignados. Revisá primero esas asignaciones.",
      impact_confirmation_required: "Confirmá el impacto antes de desactivar. Los turnos existentes no se cancelarán.",
    };
    return { error: messages[result.error.message] ?? (result.error.code === "23505" ? "Ya existe ese perfil. Revisá los profesionales registrados." : "No pudimos guardar. No se aplicaron cambios; tus datos siguen en el formulario.") };
  }

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
