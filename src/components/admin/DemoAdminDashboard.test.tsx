import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DemoAdminDashboard } from "./DemoAdminDashboard";
import { demoBookings } from "@/data/demo-bookings";
import { monthlySpecials, treatments } from "@/data/fixtures";
import type { DemoBooking } from "@/domain/treatment";

const createdBooking: DemoBooking = {
  id: "booking-created-demo",
  code: "PC-DEMO-4821",
  treatmentId: "treatment-relajacion",
  customerName: "Ana Demo",
  phone: "351 555 0099",
  startsAt: "2026-08-01T09:00:00-03:00",
  durationMinutes: 60,
  priceCents: 6500000,
  status: "pending",
  createdAt: "2026-07-31T23:30:00-03:00",
  isNew: true,
};

describe("DemoAdminDashboard", () => {
  it("shows seeded states and highlights a booking created in the public demo", async () => {
    const user = userEvent.setup();
    render(
      <DemoAdminDashboard
        initialBookings={demoBookings}
        treatments={treatments}
        monthlySpecials={monthlySpecials}
        createdBooking={createdBooking}
      />,
    );

    expect(screen.getByText(/La reserva PC-DEMO-4821 llegó al panel/)).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirmado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cancelado").length).toBeGreaterThan(0);

    const inspector = screen.getByLabelText("Detalle de Ana Demo");
    await user.click(within(inspector).getByRole("button", { name: "Confirmar seña" }));
    expect(within(inspector).getByText("Confirmado")).toBeInTheDocument();
  });

  it("filters the reservation list by status", async () => {
    const user = userEvent.setup();
    render(
      <DemoAdminDashboard
        initialBookings={demoBookings}
        treatments={treatments}
        monthlySpecials={monthlySpecials}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Canceladas" }));
    const list = screen.getByRole("region", { name: "Listado de reservas" });
    expect(within(list).getByRole("button", { name: /Carolina Díaz/ })).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: /Sofía Ramírez/ })).not.toBeInTheDocument();
  });
});
