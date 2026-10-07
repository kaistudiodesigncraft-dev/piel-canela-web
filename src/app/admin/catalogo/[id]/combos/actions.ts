"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { pesosToCents } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  isTreatmentDeleteCodeConfigured,
  verifyTreatmentDeleteCode,
} from "@/lib/admin/treatment-delete-code";

const audienceSchema = z.enum(["women", "men", "shared"]);
const zoneSchema = z.object({
  zoneId: z.string().uuid().optional(),
  treatmentId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  audience: audienceSchema,
  referencePricePesos: z.coerce.number().int().min(0),
  durationMinutes: z.coerce.number().int().min(5).max(240),
  displayOrder: z.coerce.number().int().min(0).max(999),
});
const comboSchema = z.object({
  comboId: z.string().uuid().optional(),
  treatmentId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  audience: audienceSchema,
  mode: z.enum(["single_session", "package"]),
  sessionCount: z.coerce.number().int().min(1).max(48),
  fixedPricePesos: z.coerce.number().int().positive(),
  pricingMode: z.enum(["fixed_price", "percentage_discount", "tiered_discount"]),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  tierMinItems: z.coerce.number().int().min(1).max(99).optional(),
  tierDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  allowPublicExtras: z.boolean().default(false),
  validityDays: z.coerce.number().int().min(1).max(730).optional(),
  displayOrder: z.coerce.number().int().min(0).max(999),
  zoneIds: z.array(z.string().uuid()).min(1),
  extraIds: z.array(z.string().uuid()).default([]),
});
const extraSchema = z.object({
  extraId: z.string().uuid().optional(),
  treatmentId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  audience: audienceSchema,
  pricePesos: z.coerce.number().int().min(0),
  durationMinutes: z.coerce.number().int().min(0).max(240),
  displayOrder: z.coerce.number().int().min(0).max(999),
});
const deleteConfigurationSchema = z.object({
  treatmentId: z.string().uuid(),
  recordId: z.string().uuid(),
  confirmationCode: z.string().trim().min(4).max(128),
  confirmDeletion: z.literal("on"),
});

function feedbackPath(treatmentId: string, value: string) {
  return `/admin/catalogo/${treatmentId}/combos?${value}`;
}

export async function saveDepilationZone(formData: FormData) {
  const result = await saveDepilationZoneResult(formData);
  redirect(feedbackPath(String(formData.get("treatmentId")), result.status === "saved" ? "zoneSaved=1" : "zoneError=invalid"));
}

export interface DepilationZoneEditorResult {
  status: "saved" | "invalid" | "failed";
  zoneId?: string;
  fieldErrors: Record<string, string[]>;
  message: string;
}

export async function saveDepilationZoneResult(formData: FormData): Promise<DepilationZoneEditorResult> {
  const { supabase } = await requireAdmin();
  const parsed = zoneSchema.safeParse({
    zoneId: formData.get("zoneId") || undefined,
    treatmentId: formData.get("treatmentId"),
    name: formData.get("name"),
    audience: formData.get("audience"),
    referencePricePesos: formData.get("referencePricePesos"),
    durationMinutes: formData.get("durationMinutes"),
    displayOrder: formData.get("displayOrder"),
  });
  if (!parsed.success) {
    return {
      status: "invalid",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      message: "Revisá los campos indicados. No se guardó la zona.",
    };
  }
  const payload = {
    name: parsed.data.name,
    audience: parsed.data.audience,
    reference_price_cents: pesosToCents(parsed.data.referencePricePesos),
    duration_minutes: parsed.data.durationMinutes,
    display_order: parsed.data.displayOrder,
    is_active: formData.get("isActive") === "on",
  };
  const result = parsed.data.zoneId
    ? await supabase.from("depilation_zones").update(payload).eq("id", parsed.data.zoneId).select("id").single()
    : await supabase.from("depilation_zones").insert(payload).select("id").single();
  if (result.error) {
    const message = result.error.message ?? "";
    if (result.error.code === "23505") {
      return { status: "failed", fieldErrors: { name: ["Ya existe una zona con ese nombre."] }, message: "No se guardó porque el nombre ya existe." };
    }
    if (message.includes("zone_used_by_active_combo")) {
      return { status: "failed", fieldErrors: { isActive: ["Esta zona integra un combo publicado. Pausá primero el combo o editá su composición."] }, message: "No se puede pausar una zona usada por un combo publicado." };
    }
    if (message.includes("zone_audience_conflict")) {
      return { status: "failed", fieldErrors: { audience: ["La etiqueta no coincide con uno o más combos donde se usa esta zona."] }, message: "No se puede cambiar la etiqueta porque rompería combos existentes." };
    }
    return { status: "failed", fieldErrors: {}, message: "No pudimos guardar la zona. Tus datos se conservan; reintentá o revisá si ya quedó guardada." };
  }
  revalidatePath(`/admin/catalogo/${parsed.data.treatmentId}/combos`);
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  return { status: "saved", zoneId: result.data.id, fieldErrors: {}, message: parsed.data.zoneId ? "Zona actualizada." : "Zona creada. Ya podés usarla en combos." };
}

export interface ComboEditorResult {
  status: "saved" | "invalid" | "failed";
  comboId?: string;
  fieldErrors: Record<string, string[]>;
  message: string;
}

export async function saveTreatmentComboResult(formData: FormData): Promise<ComboEditorResult> {
  const { supabase } = await requireAdmin();
  const mode = formData.get("mode");
  const publishing = formData.get("isActive") === "on";
  // Discount modes use the server-side zone reference total as their stored base.
  // Never ask reception to invent an unrelated fixed price just to satisfy SQL.
  let fixedPricePesos = formData.get("fixedPricePesos");
  if (formData.get("pricingMode") !== "fixed_price") {
    const ids = z.array(z.string().uuid()).min(1).safeParse(formData.getAll("zoneIds"));
    const sessions = z.coerce.number().int().min(1).max(48).safeParse(mode === "single_session" ? 1 : formData.get("sessionCount"));
    if (ids.success && sessions.success) {
      const { data, error } = await supabase.from("depilation_zones").select("reference_price_cents").in("id", ids.data);
      if (error) return { status: "failed", fieldErrors: {}, message: "No pudimos consultar las zonas. Tus datos se conservan; reintentá." };
      fixedPricePesos = String((data ?? []).reduce((sum, zone) => sum + zone.reference_price_cents, 0) * sessions.data / 100);
    }
  }
  const parsed = comboSchema.safeParse({
    comboId: formData.get("comboId") || undefined,
    treatmentId: formData.get("treatmentId"),
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    audience: formData.get("audience"),
    mode,
    sessionCount: mode === "single_session" ? 1 : formData.get("sessionCount"),
    fixedPricePesos,
    pricingMode: formData.get("pricingMode"),
    discountPercent: formData.get("discountPercent") || undefined,
    tierMinItems: formData.get("tierMinItems") || undefined,
    tierDiscountPercent: formData.get("tierDiscountPercent") || undefined,
    allowPublicExtras: formData.get("allowPublicExtras") === "on",
    validityDays: mode === "package" ? formData.get("validityDays") : undefined,
    displayOrder: formData.get("displayOrder"),
    zoneIds: formData.getAll("zoneIds"),
    extraIds: formData.getAll("extraIds"),
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    const hasZoneError = Array.isArray(fieldErrors.zoneIds) && fieldErrors.zoneIds.length > 0;
    const hasPriceError = Array.isArray(fieldErrors.fixedPricePesos) && fieldErrors.fixedPricePesos.length > 0;
    return {
      status: "invalid",
      fieldErrors,
      message: hasZoneError
        ? "Primero elegí al menos una zona activa para el combo. Tus datos siguen en pantalla."
        : hasPriceError
          ? "Indicá el precio final o elegí una regla de descuento válida. Tus datos siguen en pantalla."
          : "Revisá los campos indicados. No se guardó ningún cambio.",
    };
  }
  const { data: savedId, error } = await supabase.rpc("save_depilation_combo_v2", {
    requested_combo_id: parsed.data.comboId ?? null,
    requested_treatment_id: parsed.data.treatmentId,
    requested_name: parsed.data.name,
    requested_description: parsed.data.description,
    requested_audience: parsed.data.audience,
    requested_mode: parsed.data.mode,
    requested_session_count: parsed.data.sessionCount,
    requested_fixed_price_cents: pesosToCents(parsed.data.fixedPricePesos),
    requested_validity_days: parsed.data.mode === "package" ? parsed.data.validityDays : null,
    requested_display_order: parsed.data.displayOrder,
    requested_is_active: publishing,
    requested_zone_ids: parsed.data.zoneIds,
    requested_pricing_mode: parsed.data.pricingMode,
    requested_discount_percent: parsed.data.pricingMode === "percentage_discount" ? parsed.data.discountPercent ?? 0 : null,
    requested_tier_min_items: parsed.data.pricingMode === "tiered_discount" ? parsed.data.tierMinItems ?? 1 : null,
    requested_tier_discount_percent: parsed.data.pricingMode === "tiered_discount" ? parsed.data.tierDiscountPercent ?? 0 : null,
    requested_allow_public_extras: parsed.data.allowPublicExtras,
    requested_extra_ids: parsed.data.extraIds,
  });
  if (error) {
    const message = error.message ?? "";
    const reason = message.includes("requires_zone") || message.includes("zone_not_available") || message.includes("extra_not_available")
      ? "zones"
      : message.includes("requires_configurable_treatment")
        ? "mode"
        : error.code === "23505" ? "duplicate" : "save";
    return {
      status: "failed",
      fieldErrors: reason === "duplicate"
        ? { name: ["Ya existe un combo con ese nombre."] }
        : reason === "zones"
          ? { zoneIds: ["Usá zonas/extras activos y compatibles con la etiqueta del combo. Si cambiás Mujeres/Hombres/Compartido, revisá la selección."] }
          : reason === "mode"
            ? { treatmentId: ["Este tratamiento todavía no está configurado como Depilación con combos. Activá “Usa combos cerrados” en la ficha del tratamiento."] }
            : {},
      message: reason === "zones"
        ? "No se guardó porque alguna zona o extra no está disponible para este combo. Tus datos se conservan."
        : reason === "mode"
          ? "Antes de guardar combos, configurá el tratamiento como combo cerrado."
          : "No se guardaron los cambios. Revisá la configuración y volvé a intentar.",
    };
  }
  revalidatePath(`/admin/catalogo/${parsed.data.treatmentId}/combos`);
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  revalidatePath(`/reservar`);
  return { status: "saved", comboId: String(savedId), fieldErrors: {}, message: publishing ? "Combo publicado. El selector global también debe estar habilitado." : "Borrador guardado. No se muestra al público." };
}

export async function saveTreatmentCombo(formData: FormData) {
  const result = await saveTreatmentComboResult(formData);
  redirect(feedbackPath(String(formData.get("treatmentId")), result.status === "saved" ? "comboSaved=1" : "comboError=invalid"));
}

export async function saveTreatmentComboExtra(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = extraSchema.safeParse({
    extraId: formData.get("extraId") || undefined,
    treatmentId: formData.get("treatmentId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    audience: formData.get("audience"),
    pricePesos: formData.get("pricePesos"),
    durationMinutes: formData.get("durationMinutes"),
    displayOrder: formData.get("displayOrder"),
  });
  if (!parsed.success) redirect(feedbackPath(String(formData.get("treatmentId")), "extraError=invalid"));
  const payload = {
    treatment_id: parsed.data.treatmentId,
    name: parsed.data.name,
    description: parsed.data.description ?? "",
    audience: parsed.data.audience,
    price_cents: pesosToCents(parsed.data.pricePesos),
    duration_minutes: parsed.data.durationMinutes,
    display_order: parsed.data.displayOrder,
    is_active: formData.get("isActive") === "on",
  };
  const result = parsed.data.extraId
    ? await supabase.from("treatment_combo_extras").update(payload).eq("id", parsed.data.extraId)
    : await supabase.from("treatment_combo_extras").insert(payload);
  if (result.error) redirect(feedbackPath(parsed.data.treatmentId, `extraError=${result.error.code === "23505" ? "duplicate" : "save"}`));
  revalidatePath(`/admin/catalogo/${parsed.data.treatmentId}/combos`);
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  redirect(feedbackPath(parsed.data.treatmentId, "extraSaved=1"));
}

export async function toggleDepilationFeature(formData: FormData) {
  const { supabase } = await requireAdmin();
  const treatmentId = z.string().uuid().safeParse(formData.get("treatmentId"));
  const enabled = z.enum(["true", "false"]).safeParse(formData.get("enabled"));
  if (!treatmentId.success || !enabled.success) redirect("/admin/catalogo?comboFeatureError=invalid");
  const { error } = await supabase.from("business_settings")
    .update({ depilation_combos_enabled: enabled.data === "true" }).eq("singleton", true);
  if (error) redirect(feedbackPath(treatmentId.data, `featureError=${error.message.includes("deactivate_combo_treatments") ? "activeTreatments" : "save"}`));
  revalidatePath("/");
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  revalidatePath("/reservar");
  revalidatePath(`/admin/catalogo/${treatmentId.data}/combos`);
  redirect(feedbackPath(treatmentId.data, "featureSaved=1"));
}

function deletionGuardOrRedirect(treatmentId: string, formData: FormData) {
  const parsed = deleteConfigurationSchema.safeParse({
    treatmentId,
    recordId: formData.get("recordId"),
    confirmationCode: formData.get("confirmationCode"),
    confirmDeletion: formData.get("confirmDeletion"),
  });
  if (!parsed.success) redirect(feedbackPath(treatmentId, "deleteError=confirmation"));
  if (!isTreatmentDeleteCodeConfigured() || !verifyTreatmentDeleteCode(parsed.data.confirmationCode)) {
    redirect(feedbackPath(treatmentId, "deleteError=code"));
  }
  const guardSecret = process.env.BOOKING_GUARD_SECRET;
  if (!guardSecret || guardSecret.length < 32) {
    redirect(feedbackPath(treatmentId, "deleteError=configuration"));
  }
  return { recordId: parsed.data.recordId, guardSecret };
}

export async function deleteTreatmentCombo(formData: FormData) {
  const treatmentId = String(formData.get("treatmentId") ?? "");
  const { supabase } = await requireAdmin();
  const attempt = await supabase.rpc("register_admin_protected_action_attempt", {
    requested_action: "delete_combo",
  });
  if (attempt.error || attempt.data !== true) {
    redirect(feedbackPath(treatmentId, "deleteError=rateLimited"));
  }
  const { recordId, guardSecret } = deletionGuardOrRedirect(treatmentId, formData);
  const { error } = await supabase.rpc("delete_treatment_combo_if_unlinked", {
    requested_combo_id: recordId,
    request_guard_secret: guardSecret,
  });
  if (error) {
    redirect(feedbackPath(treatmentId, `deleteError=${error.code === "23503" ? "linked" : "failed"}`));
  }
  await supabase.rpc("clear_admin_protected_action_attempts", {
    requested_action: "delete_combo",
  });
  revalidatePath(`/admin/catalogo/${treatmentId}/combos`);
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  redirect(feedbackPath(treatmentId, "comboDeleted=1"));
}

export async function deleteDepilationZone(formData: FormData) {
  const treatmentId = String(formData.get("treatmentId") ?? "");
  const { supabase } = await requireAdmin();
  const attempt = await supabase.rpc("register_admin_protected_action_attempt", {
    requested_action: "delete_depilation_zone",
  });
  if (attempt.error || attempt.data !== true) {
    redirect(feedbackPath(treatmentId, "deleteError=rateLimited"));
  }
  const { recordId, guardSecret } = deletionGuardOrRedirect(treatmentId, formData);
  const { error } = await supabase.rpc("delete_depilation_zone_if_unlinked", {
    requested_zone_id: recordId,
    request_guard_secret: guardSecret,
  });
  if (error) {
    redirect(feedbackPath(treatmentId, `deleteError=${error.code === "23503" ? "linked" : "failed"}`));
  }
  await supabase.rpc("clear_admin_protected_action_attempts", {
    requested_action: "delete_depilation_zone",
  });
  revalidatePath(`/admin/catalogo/${treatmentId}/combos`);
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  redirect(feedbackPath(treatmentId, "zoneDeleted=1"));
}
