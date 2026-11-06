import { quoteCombo } from "./combo-quote";
import { sortCatalogItems } from "./catalog-order";
import { calculateOrder } from "./booking-engine";
import { GenericCatalog } from "./option-catalog";
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
  if (treatment.configEnabled) {
    const config = treatment.bookingConfig;
    if (!config) return false;
    if (config.mode === "simple") {
      return config.priceRule.type === "fixed" && config.priceRule.priceCents > 0;
    }
    const hasOption = treatment.bookingOptions?.some((option) => option.isActive && option.priceCents > 0) ?? false;
    const hasCombination = treatment.bookingCombinations?.some((combination) => combination.isActive && combination.priceCents > 0) ?? false;
    if (config.mode === "package") {
      return treatment.bookingCombinations?.some((combination) =>
        combination.kind === "package" && combination.isActive && combination.priceCents > 0
      ) ?? false;
    }
    if (config.mode === "options") return hasOption || (config.allowCombos && hasCombination);
    if (config.mode === "closed_combos") return hasCombination;
    return hasCombination || (config.allowLooseOptions && hasOption);
  }
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

export function buildConfiguredBookingHref(input: {
  treatmentId: string;
  combinationId: string | null;
  optionIds: readonly string[];
}) {
  const params = new URLSearchParams({ treatmentId: input.treatmentId, bookingOrder: "1" });
  if (input.combinationId) params.set("combinationId", input.combinationId);
  for (const optionId of input.optionIds) params.append("optionId", optionId);
  return `/reservar?${params.toString()}`;
}

export function buildConfiguredTreatmentSelectionHref(
  treatmentSlug: string,
  input: { combinationId: string | null; optionIds: readonly string[] },
) {
  const params = new URLSearchParams();
  if (input.combinationId) params.set("combinationId", input.combinationId);
  for (const optionId of input.optionIds) params.append("optionId", optionId);
  const query = params.toString();
  return `/tratamientos/${treatmentSlug}${query ? `?${query}` : ""}#opciones`;
}

function configuredCatalog(treatment: Treatment) {
  return new GenericCatalog(
    treatment.id,
    (treatment.bookingOptions ?? []).map((option) => ({
      id: option.id,
      treatment_id: treatment.id,
      name: option.name,
      price_cents: option.priceCents,
      duration_minutes: option.durationMinutes,
      display_order: option.displayOrder,
      is_active: option.isActive,
    })),
    (treatment.bookingCombinations ?? []).map((combination) => ({
      id: combination.id,
      treatment_id: treatment.id,
      name: combination.name,
      kind: combination.kind,
      price_cents: combination.priceCents,
      duration_minutes: combination.durationMinutes,
      included_option_ids: combination.includedOptionIds,
      allowed_addon_option_ids: combination.allowedAddonOptionIds,
      session_count: combination.sessionCount,
      package_rules: combination.packageRules ?? null,
      display_order: combination.displayOrder,
      is_active: combination.isActive,
    })),
  );
}

export function resolveConfiguredBookingSelection(
  treatment: Treatment,
  combinationId: string | null,
  optionIds: readonly string[],
): ResolvedBookingSelection {
  if (!treatment.configEnabled || !treatment.bookingConfig) throw new Error("configured_flow_unavailable");
  const catalog = configuredCatalog(treatment);
  const order = calculateOrder(treatment.bookingConfig, catalog, { combinationId, optionIds });
  const combination = combinationId ? catalog.getCombination(combinationId) : undefined;
  const selectedOptions = optionIds.map((id) => catalog.getOption(id)).filter((option) => option !== undefined);
  const includedNames = combination?.includedOptionIds
    .map((id) => catalog.getOption(id)?.name)
    .filter((name): name is string => Boolean(name)) ?? [];
  return {
    treatmentId: treatment.id,
    treatmentName: treatment.name,
    bookingOrderV2: { combinationId, optionIds: [...optionIds] },
    optionLabelPlural: treatment.bookingConfig.optionsLabel.plural,
    comboName: combination?.name,
    comboZones: includedNames,
    comboExtras: selectedOptions.map((option) => option.name),
    sessionCount: combination?.sessionCount,
    durationMinutes: order.durationMinutes,
    occupiedDurationMinutes: order.durationMinutes + treatment.bufferMinutes,
    basePriceCents: order.subtotalCents,
    appliedPriceCents: order.totalCents,
    orderSnapshot: order,
  };
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
