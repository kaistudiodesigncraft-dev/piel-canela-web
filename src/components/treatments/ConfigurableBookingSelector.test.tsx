import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Treatment } from "@/domain/treatment";
import { treatments } from "@/data/fixtures";
import { ConfigurableBookingSelector } from "./ConfigurableBookingSelector";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const treatment: Treatment = {
  ...treatments[0]!,
  configEnabled: true,
  bookingConfig: {
    version: 1,
    mode: "combos_with_addons",
    optionsLabel: { singular: "zona", plural: "zonas" },
    selectionMode: "multiple",
    minSelections: 0,
    maxSelections: null,
    allowLooseOptions: true,
    allowCombos: true,
    allowAddons: true,
    priceRule: { type: "sum_with_volume_discount", minOptions: 2, discountPercent: 10, appliesTo: "loose_options_only" },
    durationRule: { type: "combo_plus_addons" },
  },
  bookingOptions: [
    { id: "option-a", name: "Opción A", priceCents: 100000, durationMinutes: 15, displayOrder: 1, isActive: true },
    { id: "option-b", name: "Opción B", priceCents: 200000, durationMinutes: 20, displayOrder: 2, isActive: true },
    { id: "option-c", name: "Opción C", priceCents: 300000, durationMinutes: 25, displayOrder: 3, isActive: true },
  ],
  bookingCombinations: [{
    id: "combo-a", name: "Propuesta A", kind: "combo", priceCents: 250000, durationMinutes: 30,
    includedOptionIds: ["option-a"], allowedAddonOptionIds: ["option-b"], sessionCount: 1, displayOrder: 1, isActive: true,
  }],
};

describe("ConfigurableBookingSelector", () => {
  it("shows only compatible additions and builds the v2 booking URL", async () => {
    const user = userEvent.setup();
    render(<ConfigurableBookingSelector treatment={treatment} />);
    await user.click(screen.getByRole("radio", { name: /Propuesta A/i }));
    expect(screen.getByText("Opción B")).toBeInTheDocument();
    expect(screen.queryByText("Opción C")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Opción B/i }));
    expect(screen.getByRole("link", { name: "Elegir fecha y horario" })).toHaveAttribute(
      "href",
      `/reservar?treatmentId=${treatment.id}&bookingOrder=1&combinationId=combo-a&optionId=option-b`,
    );
    expect(screen.getAllByText("$ 4.500")).toHaveLength(2);
  });

  it("keeps preview non-bookable", () => {
    render(<ConfigurableBookingSelector treatment={treatment} preview />);
    expect(screen.queryByRole("link", { name: "Elegir fecha y horario" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vista previa · sin reservar" })).toBeDisabled();
  });
});
