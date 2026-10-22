import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { treatments } from "@/data/fixtures";
import type { DepilationZone, Treatment, TreatmentCombo } from "@/domain/treatment";
import { resolveZoneOrder } from "@/lib/depilation-selection";
import { DepilationOrderSelector } from "./DepilationOrderSelector";

const zones: DepilationZone[] = [
  { id: "69000000-0000-4000-8000-000000000001", name: "Incluida", audience: "shared", referencePriceCents: 3000000, durationMinutes: 30, isActive: true, displayOrder: 1 },
  { id: "69000000-0000-4000-8000-000000000002", name: "Axilas", audience: "women", referencePriceCents: 1800000, durationMinutes: 15, isActive: true, displayOrder: 2 },
  { id: "69000000-0000-4000-8000-000000000003", name: "Piernas", audience: "men", referencePriceCents: 3000000, durationMinutes: 30, isActive: true, displayOrder: 3 },
];
const combo: TreatmentCombo = {
  id: "79000000-0000-4000-8000-000000000001", treatmentId: treatments[0]!.id, name: "Combo fijo",
  description: "", audience: "shared", mode: "single_session", sessionCount: 1, pricingMode: "fixed_price",
  discountPercent: null, tierMinItems: null, tierDiscountPercent: null, allowPublicExtras: false,
  fixedPriceCents: 2500000, referencePriceCents: 3000000, pricePerSessionCents: 2500000, savingsCents: 500000,
  durationMinutes: 30, validityDays: null, zones: [zones[0]!], extras: [], displayOrder: 1, isActive: true,
};
const treatment: Treatment = { ...treatments[0]!, isActive: true, selectionMode: "combo_with_extras", combos: [combo], bufferMinutes: 15,
  zoneOrder: { ready: true, discountPercent: 10, zones } };
afterEach(cleanup);
describe("depilation order selector", () => {
  it("shows combos in natural name order and zones alphabetically", () => {
    const scrambledCombos: TreatmentCombo[] = [
      { ...combo, id: "79000000-0000-4000-8000-000000000010", name: "Combo Mujeres 10" },
      { ...combo, id: "79000000-0000-4000-8000-000000000002", name: "Combo Mujeres 2" },
      { ...combo, id: "79000000-0000-4000-8000-000000000003", name: "Combo Hombres 3" },
    ];

    render(
      <DepilationOrderSelector
        treatment={{
          ...treatment,
          combos: scrambledCombos,
          zoneOrder: { ...treatment.zoneOrder!, zones: [zones[2]!, zones[0]!, zones[1]!] },
        }}
      />,
    );

    expect(screen.getAllByRole("radio", { name: /Combo/i }).map((input) => input.closest("label")?.textContent)).toEqual([
      expect.stringContaining("Combo Hombres 3"),
      expect.stringContaining("Combo Mujeres 2"),
      expect.stringContaining("Combo Mujeres 10"),
    ]);
    expect(screen.getAllByRole("checkbox").map((input) => input.closest("label")?.textContent)).toEqual([
      expect.stringContaining("Axilas"),
      expect.stringContaining("Incluida"),
      expect.stringContaining("Piernas"),
    ]);
  });

  it("books one standalone zone without a combo and advertises the actual discount", async () => {
    const user = userEvent.setup();
    render(<DepilationOrderSelector treatment={treatment} />);
    await user.click(screen.getByRole("checkbox", { name: /Axilas/i }));
    const href = screen.getByRole("link", { name: "Elegir fecha y horario" }).getAttribute("href")!;
    const url = new URL(href, "https://example.test");
    expect(url.searchParams.getAll("zoneId")).toEqual([zones[1]!.id]);
    expect(url.searchParams.has("comboId")).toBe(false);
    expect(url.searchParams.get("zoneOrder")).toBe("1");
    expect(screen.getByText(/Desde 2 zonas sueltas tenés un 10 %/)).toBeInTheDocument();
    expect(resolveZoneOrder(treatment, undefined, [zones[1]!.id])).toMatchObject({
      appliedPriceCents: 1800000, durationMinutes: 15, occupiedDurationMinutes: 30,
    });
  });
  it("discounts loose selections and preserves them across audience filters", async () => {
    const user = userEvent.setup();
    render(<DepilationOrderSelector treatment={treatment} />);
    await user.click(screen.getByRole("checkbox", { name: /Axilas/i }));
    await user.click(screen.getByRole("button", { name: "Hombres" }));
    await user.click(screen.getByRole("checkbox", { name: /Piernas/i }));
    const summary = within(screen.getByRole("complementary", { name: "Resumen de tu elección" }));
    expect(summary.getByText("$ 43.200")).toBeInTheDocument();
    expect(summary.getByText("Descuento en zonas (10 %)")).toBeInTheDocument();
    expect(summary.getByText("45 minutos")).toBeInTheDocument();
  });
  it("keeps the combo price, discounts only two extras, and cannot repeat included zones", async () => {
    const user = userEvent.setup();
    render(<DepilationOrderSelector treatment={treatment} />);
    await user.click(screen.getByRole("checkbox", { name: /Incluida/i }));
    await user.click(screen.getByRole("radio", { name: /Combo fijo/i }));
    expect(screen.getByRole("checkbox", { name: /Incluida/i })).toBeDisabled();
    const summary = within(screen.getByRole("complementary", { name: "Resumen de tu elección" }));
    expect(summary.getAllByText("$ 25.000").length).toBeGreaterThan(0);
    expect(summary.queryByText(/Descuento en zonas/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Axilas/i }));
    expect(summary.getAllByText("$ 43.000")).toHaveLength(2);
    expect(summary.queryByText(/Descuento en zonas/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Piernas/i }));
    expect(summary.getByText("$ 68.200")).toBeInTheDocument();
    const url = new URL(screen.getByRole("link", { name: "Elegir fecha y horario" }).getAttribute("href")!, "https://example.test");
    expect(url.searchParams.get("comboId")).toBe(combo.id);
    expect(url.searchParams.getAll("zoneId")).toEqual([zones[1]!.id, zones[2]!.id]);
  });
  it("shows empty/error states and never pretends a zero-percent discount exists", async () => {
    const { rerender } = render(<DepilationOrderSelector treatment={{ ...treatment, combos: [], zoneOrder: { ready: true, discountPercent: 0, zones: [] } }} />);
    expect(screen.getByText("Todavía no hay zonas disponibles.")).toBeInTheDocument();
    rerender(<DepilationOrderSelector treatment={{ ...treatment, zoneOrder: { ready: false, discountPercent: 0, zones: [] } }} />);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    rerender(<DepilationOrderSelector treatment={{ ...treatment, zoneOrder: { ready: true, discountPercent: 0, zones } }} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Axilas/i }));
    expect(screen.queryByText(/tenés un/)).not.toBeInTheDocument();
  });
});
