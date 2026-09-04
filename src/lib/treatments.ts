import type {
  BookingInitialSelection,
  MonthlySpecial,
  ResolvedBookingSelection,
  Treatment,
  TreatmentCategorySlug,
} from "@/domain/treatment";

export function getActiveTreatments(
  source: readonly Treatment[],
): readonly Treatment[] {
  return source
    .filter((treatment) => treatment.isActive)
    .toSorted((a, b) => a.displayOrder - b.displayOrder);
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
  return `/reservar?${params.toString()}`;
}

export function resolveBookingSelection(
  treatment: Treatment,
  monthlySpecial?: MonthlySpecial,
): ResolvedBookingSelection {
  return {
    treatmentId: treatment.id,
    treatmentName: treatment.name,
    monthlySpecialId: monthlySpecial?.id,
    monthlySpecialTitle: monthlySpecial?.title,
    durationMinutes: treatment.durationMinutes,
    basePriceCents: treatment.priceCents,
    appliedPriceCents: monthlySpecial?.specialPriceCents ?? treatment.priceCents,
  };
}
