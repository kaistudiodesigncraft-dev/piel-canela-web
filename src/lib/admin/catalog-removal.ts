export interface CatalogRemovalResult {
  status: "idle" | "error" | "done";
  message: string;
  incidentId?: string;
}

export interface SpecialReassignmentTarget {
  id: string;
  name: string;
  selection_mode: "simple" | "closed_combo" | "combo_with_extras";
}

export interface SpecialVersion {
  id: string;
  updatedAt: string;
}

export function catalogRemovalError(code?: string, message = ""): string {
  if (code === "40001") return "La ficha o sus especiales cambiaron mientras revisabas esta acción. Cerrá este cuadro, recargá y revisá los datos antes de confirmar.";
  if (message.includes("treatment_requires_archive")) return "El tratamiento tiene reservas, paquetes o combos. Elegí archivar para conservar su historial.";
  if (message.includes("replacement_treatment_required")) return "Elegí otro tratamiento para conservar los especiales.";
  if (message.includes("replacement_treatment_incompatible")) return "El tratamiento de destino debe usar la misma forma de reserva.";
  if (code === "23P01") return "Los especiales se superponen con una promoción del tratamiento de destino. Elegí otro destino o revisá sus fechas.";
  if (code === "23503") return "Hay registros vinculados que deben conservarse. Usá archivar o consultá a la agencia.";
  if (code === "P0002") return "El registro ya no está disponible. Recargá la pantalla para ver su estado actual.";
  if (code === "PGRST202" || code === "42883") return "Esta función está pendiente de habilitación por la agencia. No se modificó ningún dato.";
  return "No pudimos completar la acción. Los datos se conservaron; intentá nuevamente o comunicá el código de soporte a la agencia.";
}
