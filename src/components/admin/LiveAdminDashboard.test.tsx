import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveAdminDashboard } from "./LiveAdminDashboard";
const { getManualBookingSlotsMock } = vi.hoisted(() => ({ getManualBookingSlotsMock: vi.fn() }));
vi.mock("@/app/admin/actions", () => ({ createAvailabilityException: vi.fn(), createManualBooking: vi.fn(), createSpecialty: vi.fn(), deleteAvailabilityException: vi.fn(), getManualBookingSlots: getManualBookingSlotsMock, saveMonthlySpecial: vi.fn(), signOutAdmin: vi.fn(), toggleSpecialty: vi.fn() }));
vi.mock("@/app/admin/reservas/actions", () => ({ rescheduleBooking: vi.fn(), saveBookingNotes: vi.fn() }));
vi.mock("@/components/admin/WeeklyAvailabilityEditor", () => ({ WeeklyAvailabilityEditor: () => <div>Editor semanal</div> }));
vi.mock("@/components/admin/BookingStatusTransitionForm", () => ({ BookingStatusTransitionForm: () => null }));
const props = {
  adminName: "Recepción", canManageAccess: false, referenceTime: "2026-09-10T12:00:00Z",
  specialties: [], rules: [], exceptions: [], treatments: [], treatmentCombos: [], professionals: [], monthlySpecials: [], bookings: [],
  agenda: { query: { view: "day" as const, date: "2026-09-10", status: "all" as const, page: 1 }, range: { startsAt: null, endsAt: null, previousDate: "2026-09-09", nextDate: "2026-09-11", label: "Hoy" }, total: 0, pageSize: 25, summary: { today: 0, attention: 0, confirmed: 0 } },
};
describe("Reception modules", () => {
  beforeEach(() => {
    getManualBookingSlotsMock.mockReturnValue(new Promise(() => undefined));
  });

  it("separates availability from commercial and reservation forms", () => {
    render(<LiveAdminDashboard {...props} feedback={{ module: "availability" }} />);
    expect(screen.getByText("Editor semanal")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Asignar un turno manual" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Especiales del mes" })).not.toBeInTheDocument();
  });
  it("does not mount an editor from unavailable data and preserves independent modules", () => {
    render(<LiveAdminDashboard {...props} feedback={{}} warnings={["Horarios no pudo cargarse."]} supportCode="qa-incident" unavailable={{ availability: true }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("qa-incident");
    expect(screen.queryByText("Editor semanal")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda y reservas" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegación administrativa" })).toBeInTheDocument();
  });
  it("does not represent unavailable summaries as real zero counts", () => {
    render(<LiveAdminDashboard {...props} feedback={{ module: "today" }} unavailable={{ summary: true }} />);
    expect(screen.queryByRole("region", { name: "Resumen operativo" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda y reservas" })).toBeInTheDocument();
  });
  it("offers auto assignment and eligible professionals in manual booking", () => {
    render(<LiveAdminDashboard
      {...props}
      feedback={{ module: "agenda" }}
      specialties={[{ id: "specialty", name: "Estética", slug: "estetica", description: "", display_order: 1, is_active: true }]}
      treatments={[{ id: "treatment", name: "Depilación", specialty_id: "specialty", duration_minutes: 30, buffer_minutes: 10, start_interval_minutes: 15, selection_mode: "simple", price_cents: 10000, is_active: true }]}
      professionals={[
        { id: "professional-a", full_name: "Agustina", public_name: "Agustina Spertino", specialty_id: null, is_active: true, display_order: 1, specialty_ids: [], treatment_ids: ["treatment"] },
        { id: "professional-b", full_name: "Melina", public_name: null, specialty_id: "other", is_active: true, display_order: 2, specialty_ids: [], treatment_ids: [] },
      ]}
    />);
    expect(screen.getByRole("combobox", { name: /profesional/i })).toHaveTextContent("Autoasignar disponible");
    expect(screen.getByRole("option", { name: "Agustina Spertino" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Melina" })).not.toBeInTheDocument();
  });
});
