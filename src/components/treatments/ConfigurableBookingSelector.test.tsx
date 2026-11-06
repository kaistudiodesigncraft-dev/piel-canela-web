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

  it("shows a package with its generated rules and books only the first session", async () => {
    const user = userEvent.setup();
    const packageTreatment: Treatment = {
      ...treatment,
      bookingConfig: {
        version: 1,
        mode: "package",
        optionsLabel: { singular: "paquete", plural: "paquetes" },
        selectionMode: "single",
        minSelections: 0,
        maxSelections: 0,
        allowLooseOptions: false,
        allowCombos: true,
        allowAddons: false,
        priceRule: { type: "package_price" },
        durationRule: { type: "per_session", durationMinutes: 45 },
        packageDefaults: {
          sessionsCount: 4,
          validityDays: 120,
          validityStartsFrom: "purchase",
          minDaysBetweenSessions: 14,
          releaseNoticeHours: 48,
          maxReschedulesPerSession: 1,
          absenceConsumesSession: true,
          lateReleaseConsumesSession: true,
          depositPercent: 50,
          conditionsText: null,
        },
      },
      bookingOptions: [],
      bookingCombinations: [{
        id: "package-a", name: "Plan cuidado", kind: "package", priceCents: 900000,
        durationMinutes: 45, includedOptionIds: [], allowedAddonOptionIds: [],
        sessionCount: 4, displayOrder: 1, isActive: true,
        packageRules: {
          sessionsCount: 4, validityDays: 120, validityStartsFrom: "purchase",
          minDaysBetweenSessions: 14, releaseNoticeHours: 48,
          maxReschedulesPerSession: 1, absenceConsumesSession: true,
          lateReleaseConsumesSession: true, depositPercent: 50, conditionsText: null,
        },
      }],
    };
    render(<ConfigurableBookingSelector treatment={packageTreatment} />);
    expect(screen.queryByText("Propuesta A")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Plan cuidado/i }));
    expect(screen.getByText("4 sesiones con una vigencia de 120 días desde la compra.")).toBeInTheDocument();
    expect(screen.getByText("La seña es del 50 %.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Elegir fecha y horario" })).toHaveAttribute(
      "href",
      `/reservar?treatmentId=${packageTreatment.id}&bookingOrder=1&combinationId=package-a`,
    );
    expect(screen.getByText(/La pre-reserva agenda la primera sesión/)).toBeInTheDocument();
  });
});
