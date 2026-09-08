import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PackagesAdmin } from "./PackagesAdmin";

const packageRow = {
  id: "70000000-0000-4000-8000-000000000001",
  combo_name_snapshot: "Paquete depilación",
  total_sessions: 6,
  fixed_price_snapshot_cents: 6000000,
  activated_at: "2026-09-01T12:00:00.000Z",
  expires_at: "2027-01-01T12:00:00.000Z",
  status: "active",
  customer: { full_name: "Cliente de prueba", phone: "3510000000" },
  bookings: [{
    id: "80000000-0000-4000-8000-000000000001",
    booking_code: "PC-TEST",
    starts_at: "2026-09-03T12:00:00.000Z",
    status: "no_show",
    consumed: false,
    restored: false,
  }],
};

describe("PackagesAdmin", () => {
  it("requires an explicit consume-or-return decision for a no-show", () => {
    render(<PackagesAdmin packages={[packageRow]} feedback={{}} referenceTime="2026-09-08T12:00:00.000Z" />);

    expect(screen.getByText("¿La ausencia consume esta sesión?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Consumir sesión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No consumir" })).toBeInTheDocument();
  });
});
