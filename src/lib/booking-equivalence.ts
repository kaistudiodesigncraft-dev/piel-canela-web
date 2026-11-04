import type { BookingConfig } from "./booking-config";
import { calculateOrder } from "./booking-engine";
import { calculateOrderTotal, type OrderCombo, type OrderTotal, type OrderZone } from "./depilation-order";
import type { DepilationZone, TreatmentCombo } from "@/domain/treatment";
import { GenericCatalog, LegacyDepilationCatalog } from "./option-catalog";

export interface LegacyEquivalenceDataset {
  treatmentId: string;
  discountPercent: number;
  zones: readonly DepilationZone[];
  combos: readonly TreatmentCombo[];
  bookingSnapshots: readonly {
    id: string;
    order: OrderTotal;
    context: {
      combo: OrderCombo | null;
      zones: readonly OrderZone[];
      discountPercent: number;
    };
  }[];
}

export interface EquivalenceDifference {
  case: string;
  legacy: unknown;
  universal: unknown;
}

export interface EquivalenceReport {
  comboOnlyCases: number;
  pairCases: number;
  seededCases: number;
  comboAddonCases: number;
  rejectionCases: number;
  historicalSnapshotCases: number;
  differences: readonly EquivalenceDifference[];
}

function legacyConfig(discountPercent: number): BookingConfig {
  return {
    version: 1,
    mode: "combos_with_addons",
    optionsLabel: { singular: "zona", plural: "zonas" },
    selectionMode: "multiple",
    minSelections: 0,
    maxSelections: null,
    allowLooseOptions: true,
    allowCombos: true,
    allowAddons: true,
    priceRule: {
      type: "sum_with_volume_discount",
      minOptions: 2,
      discountPercent,
      appliesTo: "loose_options_only",
    },
    durationRule: { type: "combo_plus_addons" },
  };
}

function semanticOrder(order: OrderTotal | ReturnType<typeof calculateOrder>) {
  const looseSubtotalCents = "looseSubtotalCents" in order
    ? order.looseSubtotalCents
    : order.looseOptionsSubtotalCents;
  return {
    items: order.items.map((item) => ({
      id: item.id,
      kind: item.kind === "combination" ? "combo" : item.kind === "option" ? "zone" : item.kind,
      name: item.name,
      priceCents: item.priceCents,
      durationMinutes: item.durationMinutes,
    })),
    subtotalCents: order.subtotalCents,
    looseSubtotalCents,
    discountPercent: order.discountPercent,
    discountCents: order.discountCents,
    totalCents: order.totalCents,
    durationMinutes: order.durationMinutes,
  };
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function seededSelection<T>(items: readonly T[], count: number, seed: number) {
  let state = seed >>> 0;
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    const swap = state % (index + 1);
    [pool[index], pool[swap]] = [pool[swap]!, pool[index]!];
  }
  return pool.slice(0, count);
}

export function runLegacyEquivalence(dataset: LegacyEquivalenceDataset): EquivalenceReport {
  const activeZones = dataset.zones.filter((zone) => zone.isActive && zone.referencePriceCents > 0);
  const catalog = new LegacyDepilationCatalog(dataset.treatmentId, activeZones, dataset.combos);
  const config = legacyConfig(dataset.discountPercent);
  const differences: EquivalenceDifference[] = [];
  const compare = (caseName: string, combo: OrderCombo | null, zones: readonly OrderZone[]) => {
    const legacy = calculateOrderTotal({ combo, zones, discountPercent: dataset.discountPercent });
    const universal = calculateOrder(config, catalog, {
      combinationId: combo?.id ?? null,
      optionIds: zones.map((zone) => zone.id),
    });
    const left = semanticOrder(legacy);
    const right = semanticOrder(universal);
    if (!same(left, right)) differences.push({ case: caseName, legacy: left, universal: right });
  };
  const asOrderZone = (zone: DepilationZone): OrderZone => ({
    id: zone.id,
    name: zone.name,
    priceCents: zone.referencePriceCents,
    durationMinutes: zone.durationMinutes,
  });
  const asOrderCombo = (combo: TreatmentCombo): OrderCombo => ({
    id: combo.id,
    name: combo.name,
    priceCents: combo.fixedPriceCents,
    durationMinutes: combo.durationMinutes,
    includedZoneIds: combo.zones.map((zone) => zone.id),
    sessionCount: combo.sessionCount,
  });

  let comboOnlyCases = 0;
  for (const combo of dataset.combos) {
    compare(`combo:${combo.id}`, asOrderCombo(combo), []);
    comboOnlyCases += 1;
  }

  let pairCases = 0;
  for (let first = 0; first < activeZones.length; first += 1) {
    for (let second = first + 1; second < activeZones.length; second += 1) {
      compare(`pair:${activeZones[first]!.id}:${activeZones[second]!.id}`, null, [
        asOrderZone(activeZones[first]!),
        asOrderZone(activeZones[second]!),
      ]);
      pairCases += 1;
    }
  }

  let seededCases = 0;
  for (let count = 3; count <= 6; count += 1) {
    for (let sample = 0; sample < 25; sample += 1) {
      const zones = seededSelection(activeZones, count, 20_261_029 + count * 100 + sample).map(asOrderZone);
      compare(`seeded:${count}:${sample}`, null, zones);
      seededCases += 1;
    }
  }

  let comboAddonCases = 0;
  let rejectionCases = 0;
  for (const combo of dataset.combos) {
    const orderCombo = asOrderCombo(combo);
    const available = activeZones.filter((zone) => !orderCombo.includedZoneIds.includes(zone.id));
    if (available[0]) {
      compare(`combo-addon-1:${combo.id}`, orderCombo, [asOrderZone(available[0])]);
      comboAddonCases += 1;
    }
    if (available[0] && available[1]) {
      compare(`combo-addon-2:${combo.id}`, orderCombo, [asOrderZone(available[0]), asOrderZone(available[1])]);
      comboAddonCases += 1;
    }
    const included = combo.zones[0];
    if (included) {
      let legacyError = "";
      let universalError = "";
      try {
        calculateOrderTotal({ combo: orderCombo, zones: [asOrderZone(included)], discountPercent: dataset.discountPercent });
      } catch (error) {
        legacyError = error instanceof Error ? error.message : String(error);
      }
      try {
        calculateOrder(config, catalog, { combinationId: combo.id, optionIds: [included.id] });
      } catch (error) {
        universalError = error instanceof Error ? error.message : String(error);
      }
      if (legacyError !== "zone_already_in_combo" || universalError !== "option_already_in_combination") {
        differences.push({ case: `included-rejection:${combo.id}`, legacy: legacyError, universal: universalError });
      }
      rejectionCases += 1;
    }
  }

  for (const booking of dataset.bookingSnapshots) {
    const recalculatedLegacy = calculateOrderTotal({
      combo: booking.context.combo,
      zones: booking.context.zones,
      discountPercent: booking.context.discountPercent,
    });
    const snapshotCatalog = new GenericCatalog(
      dataset.treatmentId,
      booking.context.zones.map((zone, index) => ({
        id: zone.id,
        treatment_id: dataset.treatmentId,
        name: zone.name,
        price_cents: zone.priceCents,
        duration_minutes: zone.durationMinutes,
        display_order: index,
        is_active: true,
      })),
      booking.context.combo ? [{
        id: booking.context.combo.id,
        treatment_id: dataset.treatmentId,
        name: booking.context.combo.name,
        kind: "combo",
        price_cents: booking.context.combo.priceCents,
        duration_minutes: booking.context.combo.durationMinutes,
        included_option_ids: [...booking.context.combo.includedZoneIds],
        allowed_addon_option_ids: null,
        session_count: booking.context.combo.sessionCount,
        display_order: 0,
        is_active: true,
      }] : [],
    );
    const universal = calculateOrder(legacyConfig(booking.context.discountPercent), snapshotCatalog, {
      combinationId: booking.context.combo?.id ?? null,
      optionIds: booking.context.zones.map((zone) => zone.id),
    });
    const stored = semanticOrder(booking.order);
    const legacy = semanticOrder(recalculatedLegacy);
    const universalSemantic = semanticOrder(universal);
    if (!same(stored, legacy) || !same(stored, universalSemantic)) {
      differences.push({ case: `historical:${booking.id}`, legacy: { stored, recalculated: legacy }, universal: universalSemantic });
    }
  }

  return {
    comboOnlyCases,
    pairCases,
    seededCases,
    comboAddonCases,
    rejectionCases,
    historicalSnapshotCases: dataset.bookingSnapshots.length,
    differences,
  };
}
