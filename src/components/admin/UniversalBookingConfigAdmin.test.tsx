import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createDefaultBookingConfig } from "@/lib/booking-config-editor";
import { UniversalBookingConfigAdmin } from "./UniversalBookingConfigAdmin";

vi.mock("@/app/admin/catalogo/[id]/configuracion-reserva/actions", () => ({
  saveBookingConfiguration: vi.fn(),
  saveBookingOption: vi.fn(),
  saveBookingCombination: vi.fn(),
}));

const baseTreatment = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Tratamiento configurable",
  slug: "tratamiento-configurable",
  selection_mode: "simple" as const,
  booking_config: createDefaultBookingConfig({ mode: "options", priceCents: 100_000, durationMinutes: 30 }),
  config_enabled: false,
  price_cents: 100_000,
  duration_minutes: 30,
  is_active: false,
  updated_at: "2026-11-03T12:00:00.000Z",
  total_booking_count: 0,
  configuration_valid: true,
};

const option = {
  id: "20000000-0000-4000-8000-000000000001",
  treatment_id: baseTreatment.id,
  name: "Opción A",
  description: "",
  price_cents: 150_000,
  duration_minutes: 20,
  display_order: 1,
  is_active: true,
  updated_at: "2026-11-03T12:00:00.000Z",
};

describe("UniversalBookingConfigAdmin", () => {
  it("protects every historical non-simple circuit without relying on a treatment ID", () => {
    render(<UniversalBookingConfigAdmin
      treatment={{ ...baseTreatment, selection_mode: "combo_with_extras", config_enabled: false }}
      options={[]}
      combinations={[]}
    />);
    expect(screen.getByRole("heading", { name: "Circuito histórico protegido" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir configuración histórica" })).toHaveAttribute("href", `/admin/catalogo/${baseTreatment.id}/combos`);
  });

  it("requires explicit package rules before changing to package mode", async () => {
    const user = userEvent.setup();
    render(<UniversalBookingConfigAdmin treatment={baseTreatment} options={[]} combinations={[]} />);
    expect(screen.getByRole("radio", { name: /Opciones sueltas/i })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /Paquete de sesiones/i }));
    expect(screen.getByRole("group", { name: "Preparar modalidad paquete" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Opciones sueltas/i })).toBeChecked();
    expect(screen.getByText(/No completamos valores por vos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar configuración" })).toBeEnabled();
  });

  it("uses the shared booking engine in the internal simulator", async () => {
    const user = userEvent.setup();
    render(<UniversalBookingConfigAdmin treatment={baseTreatment} options={[option]} combinations={[]} />);
    await user.click(screen.getAllByRole("checkbox", { name: /Opción A/i }).at(-1)!);
    expect(screen.getAllByText(/1\.500/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20 minutos/).length).toBeGreaterThan(0);
  });
});
