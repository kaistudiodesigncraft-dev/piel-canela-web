import type { ResolvedBookingSelection, Treatment } from "@/domain/treatment";
import { calculateOrderTotal, type OrderCombo } from "./depilation-order";

export function getMinimumZoneOrderPrice(treatment: Treatment): number | null {
  const catalog = treatment.zoneOrder;
  if (!catalog?.ready) return null;
  const zones = catalog.zones.filter(z => z.isActive && z.referencePriceCents > 0)
    .map(z => ({ id: z.id, name: z.name, priceCents: z.referencePriceCents, durationMinutes: z.durationMinutes }))
    .sort((a, b) => a.priceCents - b.priceCents);
  const prices = treatment.combos.filter(c => c.isActive && c.fixedPriceCents > 0).map(c => c.fixedPriceCents);
  // Evaluate the cheapest selection of each size through the same calculator,
  // including its rounding and threshold, rather than repeating pricing rules.
  for (let count = 1; count <= Math.min(zones.length, 100); count += 1) {
    prices.push(calculateOrderTotal({ zones: zones.slice(0, count), discountPercent: catalog.discountPercent }).totalCents);
  }
  return prices.length ? Math.min(...prices) : null;
}

export function resolveZoneOrder(treatment: Treatment, comboId: string | undefined, zoneIds: readonly string[]): ResolvedBookingSelection {
  if (!treatment.zoneOrder?.ready || !treatment.isActive) throw new Error("zone_order_unavailable");
  const combo = comboId ? treatment.combos.find(c => c.id === comboId && c.isActive) : undefined;
  if (comboId && !combo) throw new Error("combo_not_available");
  const zones = zoneIds.map(id => {
    const zone = treatment.zoneOrder!.zones.find(z => z.id === id && z.isActive && z.referencePriceCents > 0);
    if (!zone) throw new Error("zone_not_available");
    return { id: zone.id, name: zone.name, priceCents: zone.referencePriceCents, durationMinutes: zone.durationMinutes };
  });
  if (!combo && zones.length === 0) throw new Error("empty_order");
  const comboInput: OrderCombo | undefined = combo ? {
    id: combo.id, name: combo.name, priceCents: combo.fixedPriceCents,
    durationMinutes: combo.durationMinutes, includedZoneIds: combo.zones.map(z => z.id), sessionCount: combo.sessionCount,
  } : undefined;
  const order = calculateOrderTotal({ combo: comboInput, zones, discountPercent: treatment.zoneOrder.discountPercent });
  return {
    treatmentId: treatment.id, treatmentName: treatment.name, zoneOrder: true,
    zoneIds: [...zoneIds], comboId, comboName: combo?.name,
    comboMode: combo?.mode, comboAudience: combo?.audience, comboZones: combo?.zones.map(z => z.name),
    comboExtras: zones.map(z => z.name), sessionCount: combo?.sessionCount ?? 1,
    pricePerSessionCents: combo ? Math.round(order.totalCents / combo.sessionCount) : undefined,
    validityDays: combo?.validityDays, basePriceCents: order.subtotalCents,
    appliedPriceCents: order.totalCents, durationMinutes: order.durationMinutes,
    occupiedDurationMinutes: order.durationMinutes + treatment.bufferMinutes, orderSnapshot: order,
  };
}
