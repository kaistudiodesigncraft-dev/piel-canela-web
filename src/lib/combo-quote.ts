import type { TreatmentCombo } from "@/domain/treatment";

/** Display estimate matching resolve_booking_selection_v2; SQL remains authoritative. */
export type ComboQuoteInput = Pick<TreatmentCombo, "allowPublicExtras" | "extras" | "audience" | "sessionCount" | "referencePriceCents" | "pricingMode" | "discountPercent" | "tierMinItems" | "tierDiscountPercent" | "fixedPriceCents" | "durationMinutes"> & { zones: readonly unknown[] };

export function quoteCombo(combo: ComboQuoteInput, extraIds: readonly string[] = []) {
  const extras = combo.allowPublicExtras
    ? combo.extras.filter((extra) => extra.isActive && extraIds.includes(extra.id)
      && (extra.audience === "shared" || extra.audience === combo.audience))
    : [];
  const extraTotal = extras.reduce((sum, extra) => sum + extra.priceCents, 0) * combo.sessionCount;
  const referencePriceCents = combo.referencePriceCents + extraTotal;
  const itemCount = combo.zones.length + extras.length;
  const discount = combo.pricingMode === "percentage_discount" ? (combo.discountPercent ?? 0)
    : combo.pricingMode === "tiered_discount" && itemCount >= (combo.tierMinItems ?? 999)
      ? (combo.tierDiscountPercent ?? 0) : 0;
  // Integer hundredths avoid floating-point rounding drift against PostgreSQL numeric.
  const discountBasisPoints = Math.round(discount * 100);
  const priceCents = Math.max(0, combo.pricingMode === "fixed_price"
    ? combo.fixedPriceCents + extraTotal
    : Math.floor((referencePriceCents * (10000 - discountBasisPoints) + 5000) / 10000));
  return {
    extras,
    priceCents,
    referencePriceCents,
    pricePerSessionCents: Math.round(priceCents / combo.sessionCount),
    savingsCents: Math.max(0, referencePriceCents - priceCents),
    durationMinutes: combo.durationMinutes + extras.reduce((sum, extra) => sum + extra.durationMinutes, 0),
  };
}
