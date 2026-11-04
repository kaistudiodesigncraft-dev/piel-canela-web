export interface BookingConfigActionState {
  status: "idle" | "saved" | "invalid" | "failed";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  incidentId?: string;
}

export const initialBookingConfigActionState: BookingConfigActionState = { status: "idle" };
