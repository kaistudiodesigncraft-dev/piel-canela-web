"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";

const restoreSchema = z.object({
  auditId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(3).max(500),
});

function historyRedirect(params: string): never {
  redirect(`/admin/historial?${params}`);
}

export async function restoreAuditRecord(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = restoreSchema.safeParse({
    auditId: formData.get("auditId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) historyRedirect("restoreError=invalid");

  const { data, error } = await supabase.rpc("restore_admin_audit_record", {
    requested_audit_id: parsed.data.auditId,
    restore_reason: parsed.data.reason,
  });

  if (error) {
    const reason = error.message.includes("not_restorable") || error.message.includes("missing")
      ? "notRestorable"
      : error.code === "23505"
        ? "conflict"
        : error.code === "42501"
          ? "permission"
          : "failed";
    historyRedirect(`restoreError=${reason}`);
  }

  const restored = Array.isArray(data) ? data[0] : null;
  revalidatePath("/admin/historial");
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/profesionales");
  revalidatePath("/tratamientos");
  revalidatePath("/reservar");
  if (restored?.restored_table === "treatments") revalidatePath("/");
  historyRedirect("restored=1");
}
