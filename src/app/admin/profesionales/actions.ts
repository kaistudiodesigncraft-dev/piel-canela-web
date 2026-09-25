"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";

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
