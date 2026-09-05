export interface SaveTreatmentState {
  status: "idle" | "invalid" | "failed";
  error?: string;
  fieldErrors?: Record<string, string[]>;
  incidentId?: string;
}

export const initialSaveTreatmentState: SaveTreatmentState = { status: "idle" };
