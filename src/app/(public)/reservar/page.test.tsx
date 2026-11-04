import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { treatments } from "@/data/fixtures";
import type { ResolvedBookingSelection, Treatment, TreatmentCombo } from "@/domain/treatment";
import BookingPage from "./page";

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), flow: vi.fn() }));
vi.mock("@/lib/supabase/public-catalog", () => ({
  getPublicCatalogSnapshot: mocks.catalog,
  getPublicBookingSettings: async () => ({ maximumAdvanceDays: 14, whatsappNumber: null }),
}));
vi.mock("@/lib/supabase/site-content", () => ({ getSiteContent: async () => [] }));
vi.mock("@/components/booking/LiveBookingFlow", () => ({
  LiveBookingFlow: ({ selection }: { selection: ResolvedBookingSelection }) => {
    mocks.flow(selection);
    return <div>Calendario de {selection.comboName ?? selection.treatmentName}</div>;
  },
}));

const combo: TreatmentCombo = {
  id: "combo-publicado", treatmentId: treatments[0]!.id, name: "Combo publicado", description: "",
  audience: "shared", mode: "single_session", sessionCount: 1, pricingMode: "fixed_price",
  discountPercent: null, tierMinItems: null, tierDiscountPercent: null, allowPublicExtras: true,
  fixedPriceCents: 100000, referencePriceCents: 120000, pricePerSessionCents: 100000, savingsCents: 20000,
  durationMinutes: 30, validityDays: null, displayOrder: 1, isActive: true,
  zones: [{ id: "zona", name: "Zona", audience: "shared", referencePriceCents: 120000, durationMinutes: 30, displayOrder: 1, isActive: true }],
  extras: [{ id: "extra", treatmentId: treatments[0]!.id, name: "Extra", description: "", audience: "shared", priceCents: 20000, durationMinutes: 10, displayOrder: 1, isActive: true }],
};
const treatment: Treatment = { ...treatments[0]!, selectionMode: "combo_with_extras", bufferMinutes: 15, combos: [combo] };
const configuredOptionId = "91000000-0000-4000-8000-000000000001";
const configuredComboId = "92000000-0000-4000-8000-000000000001";
const configuredTreatment: Treatment = {
  ...treatments[0]!,
  configEnabled: true,
  bookingConfig: {
    version: 1, mode: "combos_with_addons", optionsLabel: { singular: "área", plural: "áreas" },
    selectionMode: "multiple", minSelections: 0, maxSelections: null,
    allowLooseOptions: true, allowCombos: true, allowAddons: true,
    priceRule: { type: "combo_price" }, durationRule: { type: "combo_plus_addons" },
  },
  bookingOptions: [{ id: configuredOptionId, name: "Área adicional", priceCents: 100000, durationMinutes: 10, displayOrder: 1, isActive: true }],
  bookingCombinations: [{ id: configuredComboId, name: "Propuesta configurada", kind: "combo", priceCents: 400000, durationMinutes: 30, includedOptionIds: [], allowedAddonOptionIds: [configuredOptionId], sessionCount: 1, displayOrder: 1, isActive: true }],
};

describe("BookingPage configurable treatment", () => {
  beforeEach(() => {
    mocks.flow.mockClear();
    mocks.catalog.mockResolvedValue({ treatments: [treatment], monthlySpecials: [], categories: [], source: "supabase" });
  });
  afterEach(cleanup);

  it("opens the calendar directly with the published combo and extras from the URL", async () => {
    render(await BookingPage({ searchParams: Promise.resolve({ treatmentId: treatment.id, comboId: combo.id, extraId: "extra" }) }));
    expect(screen.getByText("Calendario de Combo publicado")).toBeInTheDocument();
    expect(mocks.flow).toHaveBeenCalledWith(expect.objectContaining({
      comboId: combo.id, extraIds: ["extra"], appliedPriceCents: 120000,
      durationMinutes: 40, occupiedDurationMinutes: 55,
    }));
    expect(screen.queryByText("Ver combos")).not.toBeInTheDocument();
  });

  it("does not send a hidden combo back into an empty selector loop", async () => {
    mocks.catalog.mockResolvedValue({ treatments: [{ ...treatment, combos: [] }], monthlySpecials: [] });
    render(await BookingPage({ searchParams: Promise.resolve({ treatmentId: treatment.id, comboId: combo.id }) }));
    expect(screen.getByRole("heading", { name: "Este combo no está disponible para reservar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al catálogo" })).toHaveAttribute("href", "/tratamientos");
    expect(mocks.flow).not.toHaveBeenCalled();
  });

  it("keeps simple treatments bookable without a combo", async () => {
    mocks.catalog.mockResolvedValue({ treatments: [treatments[0]], monthlySpecials: [] });
    render(await BookingPage({ searchParams: Promise.resolve({ treatmentId: treatments[0]!.id }) }));
    expect(mocks.flow).toHaveBeenCalledWith(expect.objectContaining({ treatmentId: treatments[0]!.id, comboId: undefined }));
  });

  it("routes an explicitly configured selection through booking-order-v2", async () => {
    mocks.catalog.mockResolvedValue({ treatments: [configuredTreatment], monthlySpecials: [], categories: [], source: "supabase" });
    render(await BookingPage({ searchParams: Promise.resolve({
      treatmentId: configuredTreatment.id,
      bookingOrder: "1",
      combinationId: configuredComboId,
      optionId: configuredOptionId,
    }) }));
    expect(screen.getByText("Calendario de Propuesta configurada")).toBeInTheDocument();
    expect(mocks.flow).toHaveBeenCalledWith(expect.objectContaining({
      bookingOrderV2: { combinationId: configuredComboId, optionIds: [configuredOptionId] },
      appliedPriceCents: 500000,
      durationMinutes: 40,
      optionLabelPlural: "áreas",
    }));
  });

  it("rejects legacy query parameters for a configured treatment", async () => {
    mocks.catalog.mockResolvedValue({ treatments: [configuredTreatment], monthlySpecials: [], categories: [], source: "supabase" });
    render(await BookingPage({ searchParams: Promise.resolve({
      treatmentId: configuredTreatment.id,
      bookingOrder: "1",
      comboId: combo.id,
    }) }));
    expect(screen.getByRole("heading", { name: "Revisá tu elección" })).toBeInTheDocument();
    expect(mocks.flow).not.toHaveBeenCalled();
  });
});
