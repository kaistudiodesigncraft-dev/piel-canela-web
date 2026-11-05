import { z } from "zod";
import type { TreatmentSelectionMode } from "@/domain/treatment";

const integerCents = z.number().int().nonnegative();
const positiveMinutes = z.number().int().positive();

export const ServicePackageRulesSchema = z.object({
  sessionsCount: z.number().int().min(2).max(100),
  validityDays: z.number().int().min(1).max(3650),
  validityStartsFrom: z.enum(["purchase", "first_session"]),
  minDaysBetweenSessions: z.number().int().min(0).max(365).nullable(),
  releaseNoticeHours: z.number().int().min(0).max(8760),
  maxReschedulesPerSession: z.number().int().min(0).max(50),
  absenceConsumesSession: z.boolean(),
  lateReleaseConsumesSession: z.boolean(),
  depositPercent: z.number().min(0).max(100).nullable(),
  conditionsText: z.string().trim().max(2_000).nullable(),
});

export type ServicePackageRules = z.infer<typeof ServicePackageRulesSchema>;

export const BOOKING_CONFIG_VERSION = 1 as const;

export const BookingConfigSchema = z.object({
  version: z.literal(BOOKING_CONFIG_VERSION),
  mode: z.enum(["simple", "options", "closed_combos", "combos_with_addons", "package"]),
  optionsLabel: z.object({
    singular: z.string().trim().min(1).max(40),
    plural: z.string().trim().min(1).max(40),
  }),
  selectionMode: z.enum(["single", "multiple"]),
  minSelections: z.number().int().min(0).max(100),
  maxSelections: z.number().int().min(0).max(100).nullable(),
  allowLooseOptions: z.boolean(),
  allowCombos: z.boolean(),
  allowAddons: z.boolean(),
  priceRule: z.discriminatedUnion("type", [
    z.object({ type: z.literal("fixed"), priceCents: integerCents }),
    z.object({ type: z.literal("sum_of_options") }),
    z.object({
      type: z.literal("sum_with_volume_discount"),
      minOptions: z.number().int().min(1).max(100),
      discountPercent: z.number().min(0).max(100),
      appliesTo: z.literal("loose_options_only"),
    }),
    z.object({ type: z.literal("combo_price") }),
    z.object({ type: z.literal("package_price") }),
  ]),
  durationRule: z.discriminatedUnion("type", [
    z.object({ type: z.literal("fixed"), durationMinutes: positiveMinutes }),
    z.object({ type: z.literal("sum_of_options") }),
    z.object({ type: z.literal("combo_plus_addons") }),
    z.object({ type: z.literal("per_session"), durationMinutes: positiveMinutes }),
  ]),
  packageDefaults: ServicePackageRulesSchema.optional(),
  conditionsText: z.string().trim().max(2_000).nullable().optional(),
}).superRefine((config, context) => {
  if (config.maxSelections !== null && config.maxSelections < config.minSelections) {
    context.addIssue({
      code: "custom",
      path: ["maxSelections"],
      message: "El máximo no puede ser menor que el mínimo.",
    });
  }
  if (config.selectionMode === "single" && (config.maxSelections === null || config.maxSelections > 1)) {
    context.addIssue({
      code: "custom",
      path: ["maxSelections"],
      message: "Una selección individual admite como máximo una opción.",
    });
  }

  const invalid = (path: string, message: string) => context.addIssue({
    code: "custom",
    path: [path],
    message,
  });

  switch (config.mode) {
    case "simple":
      if (config.allowLooseOptions || config.allowCombos || config.allowAddons) invalid("mode", "Un tratamiento simple no admite opciones, combos ni adicionales.");
      if (config.selectionMode !== "single") invalid("selectionMode", "Un tratamiento simple no tiene selección múltiple.");
      if (config.minSelections !== 0 || config.maxSelections !== 0) invalid("minSelections", "Un tratamiento simple no requiere selecciones.");
      if (config.priceRule.type !== "fixed") invalid("priceRule", "Un tratamiento simple usa un precio fijo.");
      if (config.durationRule.type !== "fixed") invalid("durationRule", "Un tratamiento simple usa una duración fija.");
      break;
    case "options":
      if (!config.allowLooseOptions || config.allowAddons) invalid("mode", "La modalidad de opciones requiere opciones sueltas y no admite adicionales sobre un combo.");
      if (!["sum_of_options", "sum_with_volume_discount"].includes(config.priceRule.type)) invalid("priceRule", "Las opciones se cobran por suma, con o sin descuento por cantidad.");
      if (config.durationRule.type !== "sum_of_options") invalid("durationRule", "La duración debe sumar las opciones elegidas.");
      break;
    case "closed_combos":
      if (config.allowLooseOptions || !config.allowCombos || config.allowAddons) invalid("mode", "Los combos cerrados solo permiten elegir un combo.");
      if (config.selectionMode !== "single" || config.minSelections !== 0 || config.maxSelections !== 0) invalid("selectionMode", "Los combos cerrados permiten un combo y ninguna opción suelta.");
      if (config.priceRule.type !== "combo_price") invalid("priceRule", "Los combos cerrados usan el precio propio del combo.");
      if (config.durationRule.type !== "fixed" && config.durationRule.type !== "sum_of_options") invalid("durationRule", "El combo usa su duración propia o la suma de sus opciones.");
      break;
    case "combos_with_addons":
      if (!config.allowCombos || !config.allowAddons) invalid("mode", "Esta modalidad requiere combos y adicionales habilitados.");
      if (config.selectionMode !== "multiple") invalid("selectionMode", "Los adicionales requieren selección múltiple.");
      if (!["combo_price", "sum_with_volume_discount"].includes(config.priceRule.type)) invalid("priceRule", "El combo conserva su precio y los adicionales pueden sumar un descuento propio.");
      if (config.durationRule.type !== "combo_plus_addons") invalid("durationRule", "La duración debe sumar combo y adicionales.");
      break;
    case "package":
      if (config.allowLooseOptions || !config.allowCombos || config.allowAddons) invalid("mode", "Un paquete solo permite elegir el paquete publicado.");
      if (config.selectionMode !== "single" || config.minSelections !== 0 || config.maxSelections !== 0) invalid("selectionMode", "Un paquete permite elegir un paquete y ninguna opción suelta.");
      if (config.priceRule.type !== "package_price") invalid("priceRule", "Un paquete usa su precio propio.");
      if (config.durationRule.type !== "per_session") invalid("durationRule", "Un paquete define la duración de cada sesión.");
      if (!config.packageDefaults) invalid("packageDefaults", "Un paquete necesita reglas operativas predeterminadas.");
      break;
  }
});

export type BookingConfig = z.infer<typeof BookingConfigSchema>;

export interface TreatmentConfigSource {
  config_enabled?: boolean | null;
  booking_config?: unknown;
  selection_mode: TreatmentSelectionMode;
  price_cents: number;
  duration_minutes: number;
}

export type ResolvedTreatmentConfig = {
  source: "configured" | "legacy";
  config: BookingConfig;
};

function legacyConfig(treatment: TreatmentConfigSource): BookingConfig {
  if (treatment.selection_mode === "simple") {
    return BookingConfigSchema.parse({
      version: BOOKING_CONFIG_VERSION,
      mode: "simple",
      optionsLabel: { singular: "opción", plural: "opciones" },
      selectionMode: "single",
      minSelections: 0,
      maxSelections: 0,
      allowLooseOptions: false,
      allowCombos: false,
      allowAddons: false,
      priceRule: { type: "fixed", priceCents: treatment.price_cents },
      durationRule: { type: "fixed", durationMinutes: treatment.duration_minutes },
    });
  }

  if (treatment.selection_mode === "closed_combo") {
    return BookingConfigSchema.parse({
      version: BOOKING_CONFIG_VERSION,
      mode: "closed_combos",
      optionsLabel: { singular: "zona", plural: "zonas" },
      selectionMode: "single",
      minSelections: 0,
      maxSelections: 0,
      allowLooseOptions: false,
      allowCombos: true,
      allowAddons: false,
      priceRule: { type: "combo_price" },
      durationRule: { type: "sum_of_options" },
    });
  }

  return BookingConfigSchema.parse({
    version: BOOKING_CONFIG_VERSION,
    mode: "combos_with_addons",
    optionsLabel: { singular: "zona", plural: "zonas" },
    selectionMode: "multiple",
    minSelections: 0,
    maxSelections: null,
    allowLooseOptions: true,
    allowCombos: true,
    allowAddons: true,
    priceRule: {
      type: "sum_with_volume_discount",
      minOptions: 2,
      discountPercent: 0,
      appliesTo: "loose_options_only",
    },
    durationRule: { type: "combo_plus_addons" },
  });
}

/**
 * Resolves only the configuration contract. It does not activate a new flow or
 * infer a treatment by slug/ID. Existing treatments stay on their legacy path
 * until config_enabled is explicitly true.
 */
export function resolveTreatmentConfig(treatment: TreatmentConfigSource): ResolvedTreatmentConfig {
  if (treatment.config_enabled === true) {
    return { source: "configured", config: BookingConfigSchema.parse(treatment.booking_config) };
  }
  return { source: "legacy", config: legacyConfig(treatment) };
}
