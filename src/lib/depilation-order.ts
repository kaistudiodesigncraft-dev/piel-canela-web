/** The sole pricing formula for the zone-order flow, shared with the server. */
export const DISCOUNT_MIN_ZONES = 2;

export interface OrderZone {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
}
export interface OrderCombo extends OrderZone {
  includedZoneIds: readonly string[];
  sessionCount: number;
}
export interface OrderInput {
  combo?: OrderCombo | null;
  zones: readonly OrderZone[];
  discountPercent: number;
}
export interface OrderTotal {
  items: readonly (OrderZone & { kind: "combo" | "zone" })[];
  subtotalCents: number;
  looseSubtotalCents: number;
  discountPercent: number;
  discountCents: number;
  totalCents: number;
  durationMinutes: number;
}

export function calculateOrderTotal({ combo, zones, discountPercent }: OrderInput): OrderTotal {
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)
    throw new Error("invalid_discount");
  if (new Set(zones.map(z => z.id)).size !== zones.length)
    throw new Error("duplicate_zone");
  if (zones.some(z => combo?.includedZoneIds.includes(z.id)))
    throw new Error("zone_already_in_combo");
  const items: OrderTotal["items"] = [
    ...(combo ? [{ id: combo.id, name: combo.name, priceCents: combo.priceCents, durationMinutes: combo.durationMinutes, kind: "combo" as const }] : []),
    ...zones.map(zone => ({ ...zone, kind: "zone" as const })),
  ];
  for (const item of items) {
    if (!Number.isSafeInteger(item.priceCents) || item.priceCents <= 0 ||
      !Number.isSafeInteger(item.durationMinutes) || item.durationMinutes <= 0)
      throw new Error("invalid_order_item");
  }
  const subtotalCents = items.reduce((sum, i) => sum + i.priceCents, 0);
  const looseSubtotalCents = zones.reduce((sum, z) => sum + z.priceCents, 0);
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 2_147_483_647)
    throw new Error("order_total_too_large");
  const appliedPercent = zones.length >= DISCOUNT_MIN_ZONES ? discountPercent : 0;
  // Round the discount once to whole ARS; amounts remain stored as integer cents.
  const basisPoints = Math.round(appliedPercent * 100);
  const discountCents = Math.min(looseSubtotalCents,
    Number((BigInt(looseSubtotalCents) * BigInt(basisPoints) + BigInt(500_000)) / BigInt(1_000_000)) * 100);
  return {
    items, subtotalCents, looseSubtotalCents, discountPercent: appliedPercent,
    discountCents, totalCents: subtotalCents - discountCents,
    durationMinutes: items.reduce((sum, i) => sum + i.durationMinutes, 0),
  };
}
