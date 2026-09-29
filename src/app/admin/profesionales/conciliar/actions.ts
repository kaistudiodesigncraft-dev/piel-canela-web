"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/admin/require-admin";

export async function reconcileProfessionalIdentity(form: FormData) {
  const { supabase } = await requireOwner();
  const input = z.object({ source: z.string().uuid(), target: z.string().uuid(), reason: z.string().trim().min(10).max(1000), backup: z.string().trim().min(10).max(500), confirmed: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!input.success || input.data.source === input.data.target) redirect("/admin/profesionales/conciliar?error=invalid");
  const { error } = await supabase.rpc("reconcile_professional_identity", {
    source_professional_id: input.data.source, target_professional_id: input.data.target,
    restore_reason: input.data.reason, verified_backup_reference: input.data.backup,
  });
  if (error) {
    const reason = error.code === "23P01" ? "conflict"
      : error.message.includes("schedule_review") ? "schedule"
        : error.message.includes("already_reconciled") ? "archived" : "failed";
    redirect(`/admin/profesionales/conciliar?error=${reason}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/profesionales");
  revalidatePath("/admin/catalogo");
  revalidatePath("/tratamientos");
  revalidatePath("/reservar");
  redirect("/admin/profesionales/conciliar?saved=1");
}
