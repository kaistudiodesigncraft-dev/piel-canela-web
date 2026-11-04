import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DepilationZone, TreatmentCombo } from "@/domain/treatment";
import { runLegacyEquivalence, type LegacyEquivalenceDataset } from "./booking-equivalence";

interface RawZone {
  id: string; name: string; audience: DepilationZone["audience"]; reference_price_cents: number;
  duration_minutes: number; display_order: number; is_active: boolean;
}
interface RawCombo {
  id: string; treatment_id: string; name: string; description: string; audience: TreatmentCombo["audience"];
  mode: TreatmentCombo["mode"]; session_count: number; pricing_mode: TreatmentCombo["pricingMode"];
  discount_percent: number | null; tier_min_items: number | null; tier_discount_percent: number | null;
  allow_public_extras: boolean; fixed_price_cents: number; appointment_duration_minutes: number | null;
  validity_days: number | null; is_active: boolean; display_order: number;
}
interface RawLink { combo_id: string; zone_id: string; display_order: number }
interface RawSettings { depilation_discount_percent: number }
interface RawBooking {
  id: string;
  depilation_order_snapshot: LegacyEquivalenceDataset["bookingSnapshots"][number] extends { order: infer O; context: infer C }
    ? { order: O; context: C } | null
    : never;
}

const roots = [
  "backups/sprint-0/2026-10-28_013257",
  "backups/sprint-1/production-readonly-2026-10-29",
  "backups/sprint-1/production-readonly-2026-11-02_210726",
  "backups/sprint-1/production-readonly-2026-11-03_014847",
];
const treatmentId = "a1f1196c-ff98-4a7b-86d6-355d3273944b";

function rows<T>(root: string, table: string): T[] {
  return JSON.parse(readFileSync(resolve(root, "data", `${table}.json`), "utf8")) as T[];
}

function dataset(root: string): LegacyEquivalenceDataset {
  const zones = rows<RawZone>(root, "depilation_zones").map((zone) => ({
    id: zone.id, name: zone.name, audience: zone.audience, referencePriceCents: zone.reference_price_cents,
    durationMinutes: zone.duration_minutes, displayOrder: zone.display_order, isActive: zone.is_active,
  }));
  const zonesById = new Map(zones.map((zone) => [zone.id, zone]));
  const links = rows<RawLink>(root, "treatment_combo_zones");
  const combos = rows<RawCombo>(root, "treatment_combos")
    .filter((combo) => combo.treatment_id === treatmentId)
    .map((combo) => {
      const comboZones = links
        .filter((link) => link.combo_id === combo.id)
        .sort((left, right) => left.display_order - right.display_order)
        .map((link) => zonesById.get(link.zone_id))
        .filter((zone): zone is DepilationZone => Boolean(zone));
      const automaticDuration = comboZones.reduce((total, zone) => total + zone.durationMinutes, 0);
      const durationMinutes = combo.appointment_duration_minutes ?? automaticDuration;
      const referencePriceCents = comboZones.reduce((total, zone) => total + zone.referencePriceCents, 0) * combo.session_count;
      return {
        id: combo.id, treatmentId: combo.treatment_id, name: combo.name, description: combo.description,
        audience: combo.audience, mode: combo.mode, sessionCount: combo.session_count,
        pricingMode: combo.pricing_mode, discountPercent: combo.discount_percent,
        tierMinItems: combo.tier_min_items, tierDiscountPercent: combo.tier_discount_percent,
        allowPublicExtras: combo.allow_public_extras, fixedPriceCents: combo.fixed_price_cents,
        appointmentDurationMinutes: combo.appointment_duration_minutes, referencePriceCents,
        pricePerSessionCents: Math.round(combo.fixed_price_cents / combo.session_count),
        savingsCents: Math.max(0, referencePriceCents - combo.fixed_price_cents), durationMinutes,
        validityDays: combo.validity_days, zones: comboZones, extras: [], displayOrder: combo.display_order,
        isActive: combo.is_active,
      } satisfies TreatmentCombo;
    });
  const settings = rows<RawSettings>(root, "business_settings")[0];
  const bookingSnapshots = rows<RawBooking>(root, "bookings")
    .filter((booking): booking is RawBooking & { depilation_order_snapshot: NonNullable<RawBooking["depilation_order_snapshot"]> } => Boolean(booking.depilation_order_snapshot))
    .map((booking) => ({ id: booking.id, ...booking.depilation_order_snapshot }));
  return { treatmentId, discountPercent: Number(settings?.depilation_discount_percent ?? 0), zones, combos, bookingSnapshots };
}

describe("legacy Depilation equivalence", () => {
  for (const root of roots) {
    it(`matches the historical engine for ${root}`, () => {
      const report = runLegacyEquivalence(dataset(root));
      expect(report.comboOnlyCases).toBe(14);
      expect(report.pairCases).toBe(210);
      expect(report.seededCases).toBe(100);
      expect(report.comboAddonCases).toBe(28);
      expect(report.rejectionCases).toBe(14);
      expect(report.historicalSnapshotCases).toBe(2);
      expect(report.differences).toEqual([]);
    });
  }
});
