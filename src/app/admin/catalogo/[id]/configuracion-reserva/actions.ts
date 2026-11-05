"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BookingConfigSchema, ServicePackageRulesSchema } from "@/lib/booking-config";
import { isLegacyConfigReadOnly } from "@/lib/booking-config-editor";
import type { BookingConfigActionState } from "@/lib/admin/booking-config-action-state";
import { pesosToCents } from "@/lib/admin/operations";
import { requireAdmin } from "@/lib/admin/require-admin";

const configSubmissionSchema = z.object({
  treatmentId: z.string().uuid(),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  bookingConfigJson: z.string().min(2).max(20_000),
  configEnabled: z.boolean(),
  confirmImpact: z.boolean(),
});

const optionSchema = z.object({
  treatmentId: z.string().uuid(),
  optionId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  pricePesos: z.coerce.number().int().min(0).max(21_474_836),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  displayOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

const combinationSchema = z.object({
  treatmentId: z.string().uuid(),
  combinationId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  kind: z.enum(["combo", "package"]),
  pricePesos: z.coerce.number().int().min(0).max(21_474_836),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  sessionCount: z.coerce.number().int().min(1).max(100),
  displayOrder: z.coerce.number().int().min(0).max(9999),
  isActive: z.boolean(),
  includedOptionIds: z.array(z.string().uuid()),
  addonOptionIds: z.array(z.string().uuid()),
  packageRulesJson: z.string().max(10_000).optional(),
});

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

function failed(message: string, code?: string): BookingConfigActionState {
  const incidentId = randomUUID().slice(0, 8).toUpperCase();
  console.error("booking_config_admin_mutation", { incidentId, code: code ?? "unknown" });
  return { status: "failed", message, incidentId };
}

function revalidateEditor(treatmentId: string) {
  revalidatePath(`/admin/catalogo/${treatmentId}`);
  revalidatePath(`/admin/catalogo/${treatmentId}/configuracion-reserva`);
  revalidatePath("/admin/catalogo");
}

async function loadTreatmentGuard(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  treatmentId: string,
) {
  return supabase.from("treatments")
    .select("id,selection_mode,booking_config,config_enabled,updated_at")
    .eq("id", treatmentId)
    .maybeSingle();
}

export async function saveBookingConfiguration(
  _previousState: BookingConfigActionState,
  formData: FormData,
): Promise<BookingConfigActionState> {
  const { supabase } = await requireAdmin();
  const parsed = configSubmissionSchema.safeParse({
    treatmentId: formData.get("treatmentId"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
    bookingConfigJson: formData.get("bookingConfigJson"),
    configEnabled: formData.get("configEnabled") === "on",
    confirmImpact: formData.get("confirmImpact") === "on",
  });
  if (!parsed.success) return { status: "invalid", message: "Revisá la configuración.", fieldErrors: fieldErrors(parsed.error) };

  let configJson: unknown;
  try {
    configJson = JSON.parse(parsed.data.bookingConfigJson);
  } catch {
    return { status: "invalid", message: "La configuración no tiene un formato válido.", fieldErrors: { mode: ["Volvé a elegir la modalidad."] } };
  }
  const config = BookingConfigSchema.safeParse(configJson);
  if (!config.success) return { status: "invalid", message: "Hay reglas incompatibles.", fieldErrors: fieldErrors(config.error) };
  if (config.data.mode === "package" && parsed.data.configEnabled) {
    return { status: "invalid", message: "Los paquetes todavía están en preparación.", fieldErrors: { mode: ["Podés preparar esta modalidad, pero se habilitará en el release de paquetes."] } };
  }

  const currentResult = await loadTreatmentGuard(supabase, parsed.data.treatmentId);
  if (currentResult.error) return failed("No pudimos consultar la versión actual.", currentResult.error.code);
  const current = currentResult.data;
  if (!current) return { status: "failed", message: "El tratamiento ya no existe." };
  if (isLegacyConfigReadOnly({ configEnabled: current.config_enabled, legacySelectionMode: current.selection_mode })) {
    return { status: "invalid", message: "Este tratamiento conserva su circuito histórico.", fieldErrors: { mode: ["No se convierte desde este editor."] } };
  }

  const changed = JSON.stringify(current.booking_config) !== JSON.stringify(config.data)
    || current.config_enabled !== parsed.data.configEnabled;
  if (changed) {
    const bookingsResult = await supabase.from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("treatment_id", parsed.data.treatmentId);
    if (bookingsResult.error) return failed("No pudimos verificar el historial de reservas.", bookingsResult.error.code);
    if ((bookingsResult.count ?? 0) > 0 && !parsed.data.confirmImpact) {
      return {
        status: "invalid",
        message: "Este tratamiento tiene reservas registradas.",
        fieldErrors: { confirmImpact: ["Confirmá que revisaste el impacto antes de cambiar la modalidad."] },
      };
    }
  }

  if (parsed.data.configEnabled) {
    const [optionResult, combinationResult] = await Promise.all([
      supabase.from("treatment_options").select("id", { count: "exact", head: true })
        .eq("treatment_id", parsed.data.treatmentId).eq("is_active", true).gt("price_cents", 0),
      supabase.from("treatment_option_combos").select("id", { count: "exact", head: true })
        .eq("treatment_id", parsed.data.treatmentId).eq("is_active", true).gt("price_cents", 0),
    ]);
    const lookupError = optionResult.error ?? combinationResult.error;
    if (lookupError) return failed("No pudimos comprobar si la configuración está lista.", lookupError.code);
    const activeOptions = optionResult.count ?? 0;
    const activeCombinations = combinationResult.count ?? 0;
    const ready = config.data.mode === "simple"
      || (config.data.mode === "options" && activeOptions > 0)
      || (config.data.mode === "closed_combos" && activeCombinations > 0)
      || (config.data.mode === "combos_with_addons" && (activeCombinations > 0 || (config.data.allowLooseOptions && activeOptions > 0)));
    if (!ready) {
      return { status: "invalid", message: "La configuración todavía no está lista.", fieldErrors: { configEnabled: ["Publicá al menos una opción o combo compatible antes de activarla."] } };
    }
  }

  const result = await supabase.from("treatments")
    .update({ booking_config: config.data, config_enabled: parsed.data.configEnabled })
    .eq("id", parsed.data.treatmentId)
    .eq("updated_at", parsed.data.expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (result.error) return failed("No pudimos guardar la configuración.", result.error.code);
  if (!result.data) return { status: "failed", message: "El tratamiento cambió en otra sesión. Recargá antes de volver a guardar." };
  revalidateEditor(parsed.data.treatmentId);
  return { status: "saved", message: parsed.data.configEnabled ? "Configuración guardada y habilitada." : "Configuración guardada como borrador." };
}

export async function saveBookingOption(
  _previousState: BookingConfigActionState,
  formData: FormData,
): Promise<BookingConfigActionState> {
  const { supabase } = await requireAdmin();
  const parsed = optionSchema.safeParse({
    treatmentId: formData.get("treatmentId"),
    optionId: formData.get("optionId") || undefined,
    expectedUpdatedAt: formData.get("expectedUpdatedAt") || undefined,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    pricePesos: formData.get("pricePesos"),
    durationMinutes: formData.get("durationMinutes"),
    displayOrder: formData.get("displayOrder"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { status: "invalid", message: "Revisá la opción.", fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.isActive && parsed.data.pricePesos <= 0) {
    return { status: "invalid", message: "La opción activa necesita precio.", fieldErrors: { pricePesos: ["Ingresá un precio mayor que cero."] } };
  }
  if (parsed.data.optionId && !parsed.data.expectedUpdatedAt) return { status: "failed", message: "Recargá la página antes de editar esta opción." };

  const guardResult = await loadTreatmentGuard(supabase, parsed.data.treatmentId);
  if (guardResult.error) return failed("No pudimos verificar el tratamiento.", guardResult.error.code);
  if (!guardResult.data?.booking_config) return { status: "invalid", message: "Guardá primero la modalidad del tratamiento." };
  if (isLegacyConfigReadOnly({ configEnabled: guardResult.data.config_enabled, legacySelectionMode: guardResult.data.selection_mode })) {
    return { status: "invalid", message: "Este tratamiento conserva su catálogo histórico." };
  }

  const values = {
    treatment_id: parsed.data.treatmentId,
    name: parsed.data.name,
    description: parsed.data.description,
    price_cents: pesosToCents(parsed.data.pricePesos),
    duration_minutes: parsed.data.durationMinutes,
    display_order: parsed.data.displayOrder,
    is_active: parsed.data.isActive,
  };
  const result = parsed.data.optionId
    ? await supabase.from("treatment_options").update(values)
      .eq("id", parsed.data.optionId)
      .eq("treatment_id", parsed.data.treatmentId)
      .eq("updated_at", parsed.data.expectedUpdatedAt ?? "")
      .select("id").maybeSingle()
    : await supabase.from("treatment_options").insert({ id: randomUUID(), ...values }).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") return { status: "invalid", message: "Ya existe una opción con ese nombre.", fieldErrors: { name: ["Usá un nombre diferente."] } };
    return failed("No pudimos guardar la opción.", result.error.code);
  }
  if (!result.data) return { status: "failed", message: "La opción cambió en otra sesión. Recargá antes de volver a guardar." };
  revalidateEditor(parsed.data.treatmentId);
  return { status: "saved", message: parsed.data.isActive ? "Opción guardada y disponible." : "Opción guardada como borrador." };
}

export async function saveBookingCombination(
  _previousState: BookingConfigActionState,
  formData: FormData,
): Promise<BookingConfigActionState> {
  const { supabase } = await requireAdmin();
  const parsed = combinationSchema.safeParse({
    treatmentId: formData.get("treatmentId"),
    combinationId: formData.get("combinationId") || undefined,
    expectedUpdatedAt: formData.get("expectedUpdatedAt") || undefined,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    kind: formData.get("kind"),
    pricePesos: formData.get("pricePesos"),
    durationMinutes: formData.get("durationMinutes"),
    sessionCount: formData.get("sessionCount"),
    displayOrder: formData.get("displayOrder"),
    isActive: formData.get("isActive") === "on",
    includedOptionIds: formData.getAll("includedOptionIds"),
    addonOptionIds: formData.getAll("addonOptionIds"),
    packageRulesJson: formData.get("packageRulesJson")?.toString() || undefined,
  });
  if (!parsed.success) return { status: "invalid", message: "Revisá la propuesta.", fieldErrors: fieldErrors(parsed.error) };
  if (parsed.data.isActive && parsed.data.pricePesos <= 0) {
    return { status: "invalid", message: "La propuesta activa necesita precio.", fieldErrors: { pricePesos: ["Ingresá un precio mayor que cero."] } };
  }
  if (parsed.data.combinationId && !parsed.data.expectedUpdatedAt) return { status: "failed", message: "Recargá la página antes de editar esta propuesta." };

  const guardResult = await loadTreatmentGuard(supabase, parsed.data.treatmentId);
  if (guardResult.error) return failed("No pudimos verificar el tratamiento.", guardResult.error.code);
  if (!guardResult.data) return { status: "failed", message: "El tratamiento ya no existe." };
  if (isLegacyConfigReadOnly({ configEnabled: guardResult.data.config_enabled, legacySelectionMode: guardResult.data.selection_mode })) {
    return { status: "invalid", message: "Este tratamiento conserva su catálogo histórico." };
  }
  const treatmentConfig = BookingConfigSchema.safeParse(guardResult.data.booking_config);
  if (!treatmentConfig.success) return { status: "invalid", message: "Guardá primero una configuración válida del tratamiento." };

  if (parsed.data.kind === "package") {
    if (treatmentConfig.data.mode !== "package") {
      return { status: "invalid", message: "La propuesta no coincide con la modalidad del tratamiento.", fieldErrors: { kind: ["Elegí primero Paquete de sesiones."] } };
    }
    if (parsed.data.includedOptionIds.length > 0 || parsed.data.addonOptionIds.length > 0) {
      return { status: "invalid", message: "Un paquete universal no usa opciones sueltas.", fieldErrors: { includedOptionIds: ["Quitá las opciones del paquete."] } };
    }
    let rawRules: unknown;
    try {
      rawRules = JSON.parse(parsed.data.packageRulesJson ?? "null");
    } catch {
      return { status: "invalid", message: "Las reglas del paquete no tienen un formato válido." };
    }
    const packageRules = ServicePackageRulesSchema.safeParse(rawRules);
    if (!packageRules.success) {
      return { status: "invalid", message: "Revisá las reglas del paquete.", fieldErrors: fieldErrors(packageRules.error) };
    }
    if (packageRules.data.sessionsCount !== parsed.data.sessionCount) {
      return { status: "invalid", message: "La cantidad de sesiones no coincide.", fieldErrors: { sessionCount: ["Usá la misma cantidad definida en las reglas."] } };
    }
    const values = {
      treatment_id: parsed.data.treatmentId,
      name: parsed.data.name,
      description: parsed.data.description,
      kind: "package" as const,
      price_cents: pesosToCents(parsed.data.pricePesos),
      duration_minutes: parsed.data.durationMinutes,
      session_count: parsed.data.sessionCount,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
      package_rules: packageRules.data,
      package_rules_version: 1,
    };
    const result = parsed.data.combinationId
      ? await supabase.from("treatment_option_combos").update(values)
        .eq("id", parsed.data.combinationId)
        .eq("treatment_id", parsed.data.treatmentId)
        .eq("kind", "package")
        .eq("updated_at", parsed.data.expectedUpdatedAt ?? "")
        .select("id").maybeSingle()
      : await supabase.from("treatment_option_combos")
        .insert({ id: randomUUID(), ...values }).select("id").single();
    if (result.error) {
      if (result.error.code === "23505") return { status: "invalid", message: "Ya existe un paquete con ese nombre.", fieldErrors: { name: ["Usá un nombre diferente."] } };
      return failed("No pudimos guardar el paquete.", result.error.code);
    }
    if (!result.data) return { status: "failed", message: "El paquete cambió en otra sesión. Recargá antes de volver a guardar." };
    revalidateEditor(parsed.data.treatmentId);
    return { status: "saved", message: parsed.data.isActive ? "Paquete guardado y disponible." : "Paquete guardado como borrador." };
  }

  if (parsed.data.includedOptionIds.length === 0) {
    return { status: "invalid", message: "La propuesta necesita al menos una opción.", fieldErrors: { includedOptionIds: ["Elegí una opción incluida."] } };
  }

  const result = await supabase.rpc("save_treatment_option_combo_v1", {
    requested_combo_id: parsed.data.combinationId ?? null,
    requested_treatment_id: parsed.data.treatmentId,
    requested_name: parsed.data.name,
    requested_description: parsed.data.description,
    requested_kind: parsed.data.kind,
    requested_price_cents: pesosToCents(parsed.data.pricePesos),
    requested_duration_minutes: parsed.data.durationMinutes,
    requested_session_count: parsed.data.sessionCount,
    requested_display_order: parsed.data.displayOrder,
    requested_is_active: parsed.data.isActive,
    requested_included_option_ids: parsed.data.includedOptionIds,
    requested_addon_option_ids: parsed.data.addonOptionIds,
    expected_updated_at: parsed.data.expectedUpdatedAt ?? null,
  });
  if (result.error) {
    const message = result.error.message ?? "";
    if (result.error.code === "23505") return { status: "invalid", message: "Ya existe una propuesta con ese nombre.", fieldErrors: { name: ["Usá un nombre diferente."] } };
    if (message.includes("version_conflict")) return { status: "failed", message: "La propuesta cambió en otra sesión. Recargá antes de volver a guardar." };
    if (message.includes("option")) return { status: "invalid", message: "Revisá las opciones incluidas y adicionales.", fieldErrors: { includedOptionIds: ["Todas deben pertenecer a este tratamiento y estar disponibles para publicar."] } };
    if (message.includes("mode") || message.includes("kind")) return { status: "invalid", message: "La propuesta no es compatible con la modalidad elegida.", fieldErrors: { kind: ["Revisá la modalidad y volvé a guardar."] } };
    return failed("No pudimos guardar la propuesta.", result.error.code);
  }
  revalidateEditor(parsed.data.treatmentId);
  return { status: "saved", message: parsed.data.isActive ? "Propuesta guardada y disponible." : "Propuesta guardada como borrador." };
}
