import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { treatments } from "@/data/fixtures";
import type { Treatment } from "@/domain/treatment";
import { TreatmentComboSelector } from "./TreatmentComboSelector";

const configurableTreatment: Treatment = {
  ...treatments[0]!,
  id: "40000000-0000-4000-8000-000000000099",
  selectionMode: "closed_combo",
  bufferMinutes: 10,
  combos: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      treatmentId: "40000000-0000-4000-8000-000000000099",
      name: "Combo compartido",
      description: "Dos zonas en una visita.",
      audience: "shared",
      mode: "package",
      sessionCount: 6,
      fixedPriceCents: 6000000,
      referencePriceCents: 7200000,
      pricePerSessionCents: 1000000,
      savingsCents: 1200000,
      durationMinutes: 30,
      validityDays: 120,
      zones: [
        { id: "60000000-0000-4000-8000-000000000001", name: "Zona A", audience: "shared", referencePriceCents: 600000, durationMinutes: 15, displayOrder: 1, isActive: true },
        { id: "60000000-0000-4000-8000-000000000002", name: "Zona B", audience: "shared", referencePriceCents: 600000, durationMinutes: 15, displayOrder: 2, isActive: true },
      ],
      displayOrder: 1,
      isActive: true,
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      treatmentId: "40000000-0000-4000-8000-000000000099",
      name: "Combo mujeres",
      description: "Una zona.", audience: "women", mode: "single_session", sessionCount: 1,
      fixedPriceCents: 1500000, referencePriceCents: 1500000, pricePerSessionCents: 1500000,
      savingsCents: 0, durationMinutes: 15, validityDays: null,
      zones: [{ id: "60000000-0000-4000-8000-000000000003", name: "Zona C", audience: "women", referencePriceCents: 1500000, durationMinutes: 15, displayOrder: 3, isActive: true }],
      displayOrder: 2, isActive: true,
    },
  ],
};

describe("TreatmentComboSelector", () => {
  it("filters one unified list and requires one closed combo", async () => {
    const user = userEvent.setup();
    render(<TreatmentComboSelector treatment={configurableTreatment} />);
    expect(screen.getByText("Combo compartido")).toBeInTheDocument();
    expect(screen.getByText("Combo mujeres")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /elegir fecha/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compartido" }));
    expect(screen.queryByText("Combo mujeres")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /combo compartido/i }));
    expect(screen.getByRole("link", { name: /elegir fecha y horario/i })).toHaveAttribute(
      "href",
      "/reservar?treatmentId=40000000-0000-4000-8000-000000000099&comboId=50000000-0000-4000-8000-000000000001",
    );
    expect(screen.getAllByText("$ 60.000")).toHaveLength(2);
    expect(screen.getByText("$ 12.000")).toBeInTheDocument();
  });
});
