import { quoteCombo } from "./combo-quote";
import { sortCatalogItems } from "./catalog-order";
import type {
  BookingInitialSelection,
  MonthlySpecial,
  ResolvedBookingSelection,
  Treatment,
  TreatmentCombo,
  TreatmentComboExtra,
  TreatmentCategorySlug,
} from "@/domain/treatment";

export function hasPublicTreatmentPrice(treatment: Treatment): boolean {
  if (treatment.selectionMode === "simple") return Number.isFinite(treatment.priceCents) && treatment.priceCents > 0;
  if (treatment.zoneOrder?.ready && treatment.zoneOrder.zones.some(z => z.isActive && z.referencePriceCents > 0)) return true;
  if (treatment.zoneOrder) return treatment.combos.some(c => c.isActive && c.fixedPriceCents > 0);
  return treatment.combos.some(combo => {
    const price = quoteCombo(combo).priceCents;
    return combo.isActive && Number.isFinite(price) && price > 0;
  });
}

export function getActiveTreatments(
  source: readonly Treatment[],
): readonly Treatment[] {
  return sortCatalogItems(
    source.filter((treatment) => treatment.isActive && hasPublicTreatmentPrice(treatment)),
    (treatment) => ({
      categoryOrder: 0,
      catalogGroup: treatment.catalogGroup ?? "default",
      isCombo: treatment.isCombo ?? false,
      displayOrder: treatment.displayOrder,
    }),
  );
}

export function filterTreatmentsByCategory(
  source: readonly Treatment[],
  categoryId: string | null,
): readonly Treatment[] {
  const active = getActiveTreatments(source);
  return categoryId
    ? active.filter((treatment) => treatment.categoryId === categoryId)
    : active;
}

export function getTreatmentBySlug(
  source: readonly Treatment[],
  slug: string,
): Treatment | undefined {
  return source.find((treatment) => treatment.slug === slug);
}

export function isMonthlySpecialPublic(
  special: MonthlySpecial,
  now = new Date(),
): boolean {
  return (
    special.isActive &&
    new Date(special.startsAt) <= now &&
    new Date(special.endsAt) > now
  );
}

export function getPublicMonthlySpecials(
  source: readonly MonthlySpecial[],
  now = new Date(),
): readonly MonthlySpecial[] {
  return source
    .filter((special) => isMonthlySpecialPublic(special, now))
    .toSorted((a, b) => a.displayOrder - b.displayOrder)
    .slice(0, 4);
}

export function getMonthlySpecialForTreatment(
  source: readonly MonthlySpecial[],
  specialId: string | null | undefined,
  treatmentId: string,
  now = new Date(),
): MonthlySpecial | undefined {
  if (!specialId) return undefined;
  return source.find(
    (special) =>
      special.id === specialId &&
      special.treatmentId === treatmentId &&
      isMonthlySpecialPublic(special, now),
  );
}

export function buildCatalogHref(
  category: TreatmentCategorySlug,
  treatmentSlug?: string,
  monthlySpecialId?: string,
): string {
  const params = new URLSearchParams({ category });
  if (treatmentSlug) params.set("treatment", treatmentSlug);
  if (monthlySpecialId) params.set("monthlySpecial", monthlySpecialId);
  return `/tratamientos?${params.toString()}#catalogo`;
}

export function buildBookingHref(selection: BookingInitialSelection): string {
  const params = new URLSearchParams({ treatmentId: selection.treatmentId });
  if (selection.monthlySpecialId) {
    params.set("monthlySpecialId", selection.monthlySpecialId);
  }
  if (selection.comboId) params.set("comboId", selection.comboId);
  for (const extraId of selection.extraIds ?? []) params.append("extraId", extraId);
  if (selection.zoneOrder) params.set("zoneOrder", "1");
  for (const zoneId of selection.zoneIds ?? []) params.append("zoneId", zoneId);
  return `/reservar?${params.toString()}`;
}

export function buildTreatmentSelectionHref(
  treatmentSlug: string,
  selection: BookingInitialSelection,
): string {
  const params = new URLSearchParams();
  if (selection.comboId) params.set("comboId", selection.comboId);
  for (const extraId of selection.extraIds ?? []) params.append("extraId", extraId);
  if (selection.zoneOrder) params.set("zoneOrder", "1");
  for (const zoneId of selection.zoneIds ?? []) params.append("zoneId", zoneId);
  const query = params.toString();
  return `/tratamientos/${treatmentSlug}${query ? `?${query}` : ""}#opciones`;
}

export function resolveBookingSelection(
  treatment: Treatment,
  monthlySpecial?: MonthlySpecial,
  combo?: TreatmentCombo,
  extras: readonly TreatmentComboExtra[] = [],
): ResolvedBookingSelection {
  if (combo && monthlySpecial) {
    throw new Error("Los combos cerrados no acumulan especiales del mes.");
  }
  const quote = combo ? quoteCombo(combo, extras.map((extra) => extra.id)) : null;
  const selectedExtras = quote?.extras ?? [];
  const durationMinutes = quote?.durationMinutes ?? treatment.durationMinutes;
  return {
    treatmentId: treatment.id,
    treatmentName: treatment.name,
    monthlySpecialId: monthlySpecial?.id,
    monthlySpecialTitle: monthlySpecial?.title,
    comboId: combo?.id,
    comboName: combo?.name,
    comboMode: combo?.mode,
    comboAudience: combo?.audience,
    comboZones: combo?.zones.map((zone) => zone.name),
    comboExtras: selectedExtras.map((extra) => extra.name),
    extraIds: selectedExtras.map((extra) => extra.id),
    pricingMode: combo?.pricingMode,
    discountSummary: combo?.pricingMode === "fixed_price" ? undefined : "Descuento calculado por Piel Canela",
    sessionCount: combo?.sessionCount,
    validityDays: combo?.validityDays,
    pricePerSessionCents: quote?.pricePerSessionCents,
    savingsCents: quote?.savingsCents,
    durationMinutes,
    occupiedDurationMinutes: durationMinutes + treatment.bufferMinutes,
    basePriceCents: quote?.referencePriceCents ?? treatment.priceCents,
    appliedPriceCents: quote?.priceCents ?? monthlySpecial?.specialPriceCents ?? treatment.priceCents,
  };
}

export function getTreatmentCombo(
  treatment: Treatment,
  comboId: string | null | undefined,
): TreatmentCombo | undefined {
  if (!comboId || treatment.selectionMode === "simple") return undefined;
  return treatment.combos.find((combo) => combo.id === comboId && combo.isActive);
}
