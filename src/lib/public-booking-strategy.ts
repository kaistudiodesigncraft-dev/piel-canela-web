import type { TreatmentSelectionMode } from "@/domain/treatment";

/**
 * The universal catalog is an explicit opt-in. Existing configurable
 * treatments keep their historical catalog until config_enabled becomes true.
 */
export function shouldAttachLegacyZoneOrder(input: {
  configEnabled: boolean;
  selectionMode: TreatmentSelectionMode;
}) {
  return !input.configEnabled && input.selectionMode !== "simple";
}
