import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BusinessSettingsAdmin, type BusinessSettingsRow } from "./BusinessSettingsAdmin";

vi.mock("@/app/admin/configuracion/actions", () => ({ saveBusinessSettings: vi.fn() }));

const settings: BusinessSettingsRow = {
  singleton: true,
  business_name: "Piel Canela",
  timezone: "America/Argentina/Cordoba",
  minimum_notice_minutes: 180,
  maximum_advance_days: 45,
  pending_expiry_minutes: 120,
  whatsapp_number: "5493515550000",
  address: "Dentro de Espacio O2",
  public_email: "hola@example.com",
  instagram_url: "https://instagram.com/pielcanela",
  deposit_text: "La seña se coordina por WhatsApp.",
  cancellation_policy: "Avisar con anticipación.",
  updated_at: "2026-08-21T12:00:00.000Z",
};

describe("BusinessSettingsAdmin", () => {
  it("renders public contact and server booking rules in one form", () => {
    render(<BusinessSettingsAdmin settings={settings} feedback={{}} />);
    expect(screen.getByLabelText("Nombre comercial")).toHaveValue("Piel Canela");
    expect(screen.getByLabelText(/Anticipación mínima/)).toHaveValue(180);
    expect(screen.getByLabelText("Política de cancelación")).toHaveValue("Avisar con anticipación.");
    expect(screen.getByRole("button", { name: "Guardar configuración" })).toBeEnabled();
  });
});
