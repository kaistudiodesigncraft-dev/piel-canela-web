"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";

const professionalSchema = z.object({
  professionalId: z.string().uuid().optional(),
  specialtyId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  publicName: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(1400).optional(),
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
    fullName: formData.get("fullName"),
    publicName: formData.get("publicName") || undefined,
    bio: formData.get("bio") || undefined,
    displayOrder: formData.get("displayOrder"),
  });
  if (!parsed.success) professionalRedirect("professionalError=invalid");

  const isActive = formData.get("isActive") === "on";
  const { data: specialty } = await supabase.from("specialties")
    .select("id,is_active").eq("id", parsed.data.specialtyId).single();
  if (!specialty?.is_active) professionalRedirect("professionalError=specialty");

  let assignedTreatments = 0;
  if (parsed.data.professionalId) {
    const [{ data: existing }, { count }] = await Promise.all([
      supabase.from("professionals").select("specialty_id,is_active")
        .eq("id", parsed.data.professionalId).single(),
      supabase.from("treatments").select("id", { count: "exact", head: true })
        .eq("professional_id", parsed.data.professionalId),
    ]);
    if (!existing) professionalRedirect("professionalError=missing");
    assignedTreatments = count ?? 0;
    if (existing.specialty_id !== parsed.data.specialtyId && assignedTreatments > 0) {
      professionalRedirect("professionalError=assigned");
    }
    if (existing.is_active && !isActive && assignedTreatments > 0 && formData.get("confirmImpact") !== "on") {
      professionalRedirect("professionalError=impact");
    }
  }

  const payload = {
    specialty_id: parsed.data.specialtyId,
    full_name: parsed.data.fullName,
    public_name: parsed.data.publicName || null,
    bio: parsed.data.bio || null,
    is_active: isActive,
    display_order: parsed.data.displayOrder,
  };
  const result = parsed.data.professionalId
    ? await supabase.from("professionals").update(payload).eq("id", parsed.data.professionalId)
    : await supabase.from("professionals").insert(payload);
  if (result.error) {
    professionalRedirect(`professionalError=${result.error.code === "23505" ? "duplicate" : "save"}`);
  }

  revalidatePath("/tratamientos");
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/profesionales");
  professionalRedirect("professionalSaved=1");
}

