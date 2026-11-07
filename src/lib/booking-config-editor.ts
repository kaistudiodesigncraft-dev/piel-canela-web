import {
  BOOKING_CONFIG_VERSION,
  BookingConfigSchema,
  type BookingConfig,
  type ServicePackageRules,
} from "./booking-config";
import type { CatalogGroup } from "./catalog-order";

export type BookingMode = BookingConfig["mode"];

export const bookingModeLabels: Record<BookingMode, string> = {
  simple: "Precio y duración únicos",
  options: "Opciones sueltas",
  closed_combos: "Combos cerrados",
  combos_with_addons: "Combos con adicionales",
  package: "Paquete de sesiones",
};

export const bookingModeDescriptions: Record<BookingMode, string> = {
  simple: "La persona reserva el tratamiento sin elegir variantes.",
  options: "La persona elige una o varias opciones y el sistema suma sus valores.",
  closed_combos: "La persona elige una propuesta publicada sin modificarla.",
  combos_with_addons: "La persona elige un combo y puede sumar adicionales autorizados.",
  package: "La persona compra varias sesiones bajo reglas congeladas al confirmar la compra.",
};

export function createDefaultBookingConfig(input: {
  mode: BookingMode;
  priceCents: number;
  durationMinutes: number;
  previous?: BookingConfig | null;
  packageDefaults?: ServicePackageRules;
}): BookingConfig {
  const common = {
    version: BOOKING_CONFIG_VERSION,
    optionsLabel: input.previous?.optionsLabel ?? { singular: "opción", plural: "opciones" },
    conditionsText: input.previous?.conditionsText ?? null,
  } as const;

  switch (input.mode) {
    case "simple":
      return BookingConfigSchema.parse({
        ...common,
        mode: "simple",
        selectionMode: "single",
        minSelections: 0,
        maxSelections: 0,
        allowLooseOptions: false,
        allowCombos: false,
        allowAddons: false,
        priceRule: { type: "fixed", priceCents: Math.max(0, input.priceCents) },
        durationRule: { type: "fixed", durationMinutes: Math.max(1, input.durationMinutes) },
      });
    case "options":
      return BookingConfigSchema.parse({
        ...common,
        mode: "options",
        selectionMode: "multiple",
        minSelections: 1,
        maxSelections: null,
        allowLooseOptions: true,
        allowCombos: false,
        allowAddons: false,
        priceRule: { type: "sum_of_options" },
        durationRule: { type: "sum_of_options" },
      });
    case "closed_combos":
      return BookingConfigSchema.parse({
        ...common,
        mode: "closed_combos",
        selectionMode: "single",
        minSelections: 0,
        maxSelections: 0,
        allowLooseOptions: false,
        allowCombos: true,
        allowAddons: false,
        priceRule: { type: "combo_price" },
        durationRule: { type: "sum_of_options" },
      });
    case "combos_with_addons":
      return BookingConfigSchema.parse({
        ...common,
        mode: "combos_with_addons",
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
    case "package":
      return BookingConfigSchema.parse({
        ...common,
        mode: "package",
        selectionMode: "single",
        minSelections: 0,
        maxSelections: 0,
        allowLooseOptions: false,
        allowCombos: true,
        allowAddons: false,
        priceRule: { type: "package_price" },
        durationRule: { type: "per_session", durationMinutes: Math.max(1, input.durationMinutes) },
        packageDefaults: input.previous?.packageDefaults ?? input.packageDefaults,
      });
  }
}

export function isLegacyConfigReadOnly(input: {
  configEnabled: boolean;
  legacySelectionMode: "simple" | "closed_combo" | "combo_with_extras";
  catalogGroup: CatalogGroup;
}) {
  return !input.configEnabled
    && input.legacySelectionMode !== "simple"
    && input.catalogGroup === "depilation";
}
