"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { catalogRemovalError, type CatalogRemovalResult } from "@/lib/admin/catalog-removal";
import { isTreatmentDeleteCodeConfigured, verifyTreatmentDeleteCode } from "@/lib/admin/treatment-delete-code";

const schema = z.object({
  entity: z.enum(["treatment", "special"]),
  id: z.string().uuid(),
  disposition: z.enum(["delete", "reassign", "archive"]),
  replacementId: z.string().uuid().optional(),
  updatedAt: z.string().datetime({ offset: true }),
  confirmationCode: z.string().trim().min(4).max(128),
  confirm: z.literal("on"),
  versions: z.array(z.object({ id: z.string().uuid(), updatedAt: z.string().datetime({ offset: true }) })).max(1000),
});

export async function removeCatalogEntry(_previous: CatalogRemovalResult, formData: FormData): Promise<CatalogRemovalResult> {
  const { supabase } = await requireAdmin();
  let versions: unknown;
  try { versions = JSON.parse(String(formData.get("versions") ?? "[]")); }
  catch { return { status: "error", message: "Recargá la ficha para verificar sus especiales antes de continuar." }; }
  const parsed = schema.safeParse({
    entity: formData.get("entity"), id: formData.get("id"), disposition: formData.get("disposition"),
    replacementId: formData.get("replacementId") || undefined, updatedAt: formData.get("updatedAt"),
    confirmationCode: formData.get("confirmationCode"), confirm: formData.get("confirm"), versions,
  });
  if (!parsed.success) return { status: "error", message: "Revisá la opción elegida, el código y la confirmación. Si la ficha cambió, recargá antes de continuar." };
  const input = parsed.data;
  if (input.entity === "special" && input.disposition !== "delete") return { status: "error", message: "La acción elegida no corresponde a un especial. Volvé a abrir el cuadro." };
  if (input.disposition === "reassign" && !input.replacementId) return { status: "error", message: "Elegí el tratamiento que conservará los especiales." };
  const guard = process.env.BOOKING_GUARD_SECRET;
  if (!isTreatmentDeleteCodeConfigured() || !guard || guard.length < 32) return { status: "error", message: "La eliminación protegida no está configurada. Contactá a la agencia." };
  const actionName = input.entity === "treatment" ? "delete_treatment" : "delete_monthly_special";
  const attempt = await supabase.rpc("register_admin_protected_action_attempt", { requested_action: actionName });
  if (attempt.error || attempt.data !== true) return { status: "error", message: "No pudimos autorizar otro intento. Esperá una hora o contactá a la agencia." };
  if (!verifyTreatmentDeleteCode(input.confirmationCode)) return { status: "error", message: "El código de eliminación no es correcto." };
  const result = input.entity === "special"
    ? await supabase.rpc("remove_monthly_special_safely", { requested_special_id: input.id, expected_updated_at: input.updatedAt, request_guard_secret: guard })
    : await supabase.rpc("remove_treatment_with_specials", {
      requested_treatment_id: input.id, requested_action: input.disposition,
      replacement_treatment_id: input.replacementId ?? null, expected_updated_at: input.updatedAt,
      expected_special_versions: input.versions, request_guard_secret: guard,
    });
  if (result.error) {
    const incidentId = randomUUID().slice(0, 8).toUpperCase();
    console.error("admin_catalog_removal", { incidentId, code: result.error.code });
    return { status: "error", message: catalogRemovalError(result.error.code, result.error.message), incidentId };
  }
  await supabase.rpc("clear_admin_protected_action_attempts", { requested_action: actionName });
  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  revalidatePath("/reservar");
  revalidatePath("/admin");
  revalidatePath("/admin/catalogo");
  revalidatePath(`/admin/catalogo/${input.id}`);
  // A deleted editor cannot render again after revalidation: its loader returns
  // notFound(). Navigate before Next attempts to refresh that removed record.
  if (input.entity === "treatment" && result.data?.outcome === "deleted") {
    redirect(`/admin/catalogo?treatmentDeleted=1${input.disposition === "reassign" ? "&specialsPreserved=1" : ""}`);
  }
  const archived = result.data?.outcome === "archived";
  return { status: "done", message: archived
    ? "Archivado: quedó fuera de la web. Sus datos e historial se conservaron."
    : input.disposition === "reassign"
      ? "Tratamiento eliminado. Sus especiales se conservaron en el destino, pausados para que los revises antes de publicarlos."
      : input.entity === "special" ? "El especial sin reservas fue eliminado. El tratamiento se conservó." : "El tratamiento y los especiales sin historial fueron eliminados." };
}
