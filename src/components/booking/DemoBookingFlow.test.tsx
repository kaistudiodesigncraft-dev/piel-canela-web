import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ResolvedBookingSelection } from "@/domain/treatment";
import { DemoBookingFlow } from "./DemoBookingFlow";

const selection: ResolvedBookingSelection = {
  treatmentId: "treatment-relajacion",
  monthlySpecialId: "special-pausa-profunda",
  treatmentName: "Relajación profunda",
  monthlySpecialTitle: "Pausa profunda",
  durationMinutes: 60,
  basePriceCents: 6500000,
  appliedPriceCents: 5500000,
};

describe("DemoBookingFlow", () => {
  it("creates a simulated booking and transfers it to the admin demo", async () => {
    const user = userEvent.setup();
    render(<DemoBookingFlow selection={selection} />);

    await user.click(screen.getByRole("button", { name: "09:00" }));
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    await user.type(screen.getByLabelText("Nombre y apellido"), "Ana Demo");
    await user.type(screen.getByLabelText("WhatsApp"), "351 555 0099");
    await user.type(screen.getByLabelText(/Correo/), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Revisar reserva" }));

    expect(screen.getByText("Sábado 1 de agosto")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Crear pre-reserva simulada" }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Tu horario quedó reservado de forma provisional.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("PC-DEMO-4821")).toBeInTheDocument();

    const adminLink = screen.getByRole("link", {
      name: /Ver esta reserva en el panel/,
    });
    expect(adminLink).toHaveAttribute("href", expect.stringContaining("/admin?"));
    expect(adminLink).toHaveAttribute(
      "href",
      expect.stringContaining("demoTreatmentId=treatment-relajacion"),
    );
    expect(adminLink).toHaveAttribute(
      "href",
      expect.stringContaining("demoMonthlySpecialId=special-pausa-profunda"),
    );

    await user.click(
      screen.getByRole("button", { name: "Simular mensaje de WhatsApp" }),
    );
    expect(screen.getByText("Vista previa del mensaje")).toBeInTheDocument();
    expect(screen.getByText(/Hola, quiero confirmar mi pre-reserva/)).toBeInTheDocument();
  });
});
