import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LiveAdminDashboard } from "./LiveAdminDashboard";
vi.mock("@/app/admin/actions", () => ({ createAvailabilityException: vi.fn(), createManualBooking: vi.fn(), createSpecialty: vi.fn(), deleteAvailabilityException: vi.fn(), saveMonthlySpecial: vi.fn(), signOutAdmin: vi.fn(), toggleSpecialty: vi.fn() }));
vi.mock("@/app/admin/reservas/actions", () => ({ rescheduleBooking: vi.fn(), saveBookingNotes: vi.fn() }));
vi.mock("@/components/admin/WeeklyAvailabilityEditor", () => ({ WeeklyAvailabilityEditor: () => <div>Editor semanal</div> }));
vi.mock("@/components/admin/BookingStatusTransitionForm", () => ({ BookingStatusTransitionForm: () => null }));
const props = {
  adminName: "Recepción", canManageAccess: false, referenceTime: "2026-09-10T12:00:00Z",
  specialties: [], rules: [], exceptions: [], treatments: [], treatmentCombos: [], monthlySpecials: [], bookings: [],
  agenda: { query: { view: "day" as const, date: "2026-09-10", status: "all" as const, page: 1 }, range: { startsAt: null, endsAt: null, previousDate: "2026-09-09", nextDate: "2026-09-11", label: "Hoy" }, total: 0, pageSize: 25, summary: { today: 0, attention: 0, confirmed: 0 } },
};
describe("Reception modules", () => {
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
});
