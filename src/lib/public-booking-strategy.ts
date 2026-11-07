import type { TreatmentSelectionMode } from "@/domain/treatment";
import type { CatalogGroup } from "@/lib/catalog-order";

/**
 * The universal catalog is an explicit opt-in. Only treatments explicitly
 * classified in the historical depilation group receive that global catalog.
 */
export function shouldAttachLegacyZoneOrder(input: {
  configEnabled: boolean;
  selectionMode: TreatmentSelectionMode;
  catalogGroup: CatalogGroup;
}) {
  return !input.configEnabled
    && input.selectionMode !== "simple"
    && input.catalogGroup === "depilation";
}
