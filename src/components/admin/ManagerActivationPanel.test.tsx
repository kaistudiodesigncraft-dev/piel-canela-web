import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ManagerActivationPanel } from "./ManagerActivationPanel";

vi.mock("@/app/admin/seguridad/activation-actions", () => ({
  generateManagerActivation: vi.fn(),
  initialManagerActivationState: { status: "idle" },
}));

describe("ManagerActivationPanel", () => {
  it("explains that activation is owner-only and does not send email", () => {
    render(<ManagerActivationPanel />);
    expect(screen.getByRole("heading", { name: "Activación presencial por QR" })).toBeInTheDocument();
    expect(screen.getByText(/no envía ningún correo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generar qr de activación/i })).toBeInTheDocument();
  });

  it("renders a downloadable one-time QR after generation", () => {
    render(<ManagerActivationPanel initialState={{
      status: "ready",
      qrDataUrl: "data:image/png;base64,AAAA",
      generatedFor: "persona@example.com",
      generatedAt: "2026-08-23T20:00:00Z",
      activationKind: "invite",
    }} />);
    expect(screen.getByAltText(/código qr de activación/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /descargar qr/i })).toHaveAttribute("download", "activacion-piel-canela.png");
    expect(screen.getByText(/persona@example.com/i)).toBeInTheDocument();
  });
});
