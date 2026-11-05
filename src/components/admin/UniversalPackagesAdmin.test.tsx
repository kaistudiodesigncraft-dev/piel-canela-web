import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UniversalPackagesAdmin, type UniversalPackageRow } from "./UniversalPackagesAdmin";

vi.mock("@/app/admin/paquetes/actions", () => ({
  decideUniversalPackageSession: vi.fn(),
  extendUniversalPackageValidity: vi.fn(),
  registerUniversalPackage: vi.fn(),
  updateUniversalPackagePayment: vi.fn(),
}));
vi.mock("@/components/admin/UniversalPackageSessionScheduler", () => ({
  UniversalPackageSessionScheduler: () => <div>Agenda de paquete</div>,
}));

const packageRow: UniversalPackageRow = {
  id: "10000000-0000-4000-8000-000000000001",
  offering_name_snapshot: "HIFU seis sesiones",
  total_sessions: 6,
  price_total_snapshot_cents: 120_000,
  price_per_session_snapshot_cents: 20_000,
  validity_until: "2026-12-01T12:00:00.000Z",
  payment_status: "deposit_paid",
  status: "active",
  rules_snapshot: {
    sessionsCount: 6,
    validityDays: 180,
    validityStartsFrom: "purchase",
    minDaysBetweenSessions: null,
    releaseNoticeHours: 48,
    maxReschedulesPerSession: 1,
    absenceConsumesSession: true,
    lateReleaseConsumesSession: true,
    depositPercent: null,
    conditionsText: null,
  },
  customer: { full_name: "Cliente de prueba", phone: "3510000000" },
  treatment: { name: "HIFU" },
  sessions: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      booking_id: "30000000-0000-4000-8000-000000000001",
      session_number: 1,
      status: "completed",
      suggested_outcome: "completed",
      decision_is_exception: false,
      decision_reason: null,
      reschedule_count_snapshot: 0,
      booking: { booking_code: "PC-TEST", starts_at: "2026-11-01T15:00:00.000Z", status: "completed", professional: null },
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      booking_id: "30000000-0000-4000-8000-000000000002",
      session_number: 2,
      status: "released",
      suggested_outcome: "released",
      decision_is_exception: false,
      decision_reason: null,
      reschedule_count_snapshot: 0,
      booking: { booking_code: "PC-LIBRE", starts_at: "2026-11-02T15:00:00.000Z", status: "cancelled", professional: null },
    },
  ],
};

describe("UniversalPackagesAdmin", () => {
  it("shows derived balance without consuming released sessions", () => {
    render(<UniversalPackagesAdmin packages={[packageRow]} candidates={[]} feedback={{}} referenceTime="2026-11-05T12:00:00.000Z" />);
    expect(screen.getByText("5 de 6")).toBeInTheDocument();
    expect(screen.getByText("Liberada")).toBeInTheDocument();
    expect(screen.getByText("Agenda de paquete")).toBeInTheDocument();
  });

  it("lists eligible pre-reservations without exposing unrelated customer data", () => {
    render(<UniversalPackagesAdmin packages={[]} candidates={[{
      id: "40000000-0000-4000-8000-000000000001",
      booking_code: "PC-CANDIDATA",
      starts_at: "2026-11-20T15:00:00.000Z",
      status: "awaiting_deposit",
      customer: { full_name: "Persona candidata", phone: "3510000000" },
      treatment: { name: "HIFU" },
      offering: { name: "Plan HIFU", session_count: 4 },
    }]} feedback={{}} referenceTime="2026-11-05T12:00:00.000Z" />);
    expect(screen.getByRole("option", { name: /PC-CANDIDATA.*Persona candidata.*HIFU.*Plan HIFU/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar compra" })).toBeEnabled();
  });
});
