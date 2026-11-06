import type { DepilationZone, TreatmentCombo } from "@/domain/treatment";
import type { ServicePackageRules } from "@/lib/booking-config";

export type CatalogItemKind = "combo" | "package";

export interface CatalogOption {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  displayOrder: number;
  isActive: boolean;
}

export interface CatalogCombination {
  id: string;
  name: string;
  kind: CatalogItemKind;
  priceCents: number;
  durationMinutes: number;
  includedOptionIds: readonly string[];
  allowedAddonOptionIds: readonly string[] | null;
  sessionCount: number;
  packageRules?: ServicePackageRules;
  displayOrder: number;
  isActive: boolean;
}

export interface OptionCatalog {
  readonly treatmentId: string;
  listOptions(): readonly CatalogOption[];
  listCombinations(): readonly CatalogCombination[];
  getOption(id: string): CatalogOption | undefined;
  getCombination(id: string): CatalogCombination | undefined;
}

export interface GenericOptionRow {
  id: string;
  treatment_id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  display_order: number;
  is_active: boolean;
}

export interface GenericCombinationRow {
  id: string;
  treatment_id: string;
  name: string;
  kind: CatalogItemKind;
  price_cents: number;
  duration_minutes: number;
  included_option_ids: readonly string[];
  allowed_addon_option_ids: readonly string[] | null;
  session_count: number;
  package_rules?: ServicePackageRules | null;
  display_order: number;
  is_active: boolean;
}

abstract class InMemoryOptionCatalog implements OptionCatalog {
  readonly treatmentId: string;
  protected readonly options: readonly CatalogOption[];
  protected readonly combinations: readonly CatalogCombination[];

  protected constructor(
    treatmentId: string,
    options: readonly CatalogOption[],
    combinations: readonly CatalogCombination[],
  ) {
    this.treatmentId = treatmentId;
    this.options = [...options];
    this.combinations = [...combinations];
  }

  listOptions() {
    return this.options;
  }

  listCombinations() {
    return this.combinations;
  }

  getOption(id: string) {
    return this.options.find((option) => option.id === id);
  }

  getCombination(id: string) {
    return this.combinations.find((combination) => combination.id === id);
  }
}

/** Reads the historical Depilation shape without copying or mutating database rows. */
export class LegacyDepilationCatalog extends InMemoryOptionCatalog {
  constructor(
    treatmentId: string,
    zones: readonly DepilationZone[],
    combos: readonly TreatmentCombo[],
  ) {
    super(
      treatmentId,
      zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        priceCents: zone.referencePriceCents,
        durationMinutes: zone.durationMinutes,
        displayOrder: zone.displayOrder,
        isActive: zone.isActive,
      })),
      combos
        .filter((combo) => combo.treatmentId === treatmentId)
        .map((combo) => ({
          id: combo.id,
          name: combo.name,
          kind: combo.mode === "package" ? "package" : "combo",
          priceCents: combo.fixedPriceCents,
          durationMinutes: combo.durationMinutes,
          includedOptionIds: combo.zones.map((zone) => zone.id),
          // The zone-order flow treats any active zone outside the combo as a
          // possible addition. A null allow-list expresses that legacy rule.
          allowedAddonOptionIds: null,
          sessionCount: combo.sessionCount,
          displayOrder: combo.displayOrder,
          isActive: combo.isActive,
        })),
    );
  }
}

/** Maps the future neutral tables into the same runtime contract. */
export class GenericCatalog extends InMemoryOptionCatalog {
  constructor(
    treatmentId: string,
    options: readonly GenericOptionRow[],
    combinations: readonly GenericCombinationRow[],
  ) {
    super(
      treatmentId,
      options
        .filter((option) => option.treatment_id === treatmentId)
        .map((option) => ({
          id: option.id,
          name: option.name,
          priceCents: option.price_cents,
          durationMinutes: option.duration_minutes,
          displayOrder: option.display_order,
          isActive: option.is_active,
        })),
      combinations
        .filter((combination) => combination.treatment_id === treatmentId)
        .map((combination) => ({
          id: combination.id,
          name: combination.name,
          kind: combination.kind,
          priceCents: combination.price_cents,
          durationMinutes: combination.duration_minutes,
          includedOptionIds: [...combination.included_option_ids],
          allowedAddonOptionIds: combination.allowed_addon_option_ids === null
            ? null
            : [...combination.allowed_addon_option_ids],
          sessionCount: combination.session_count,
          packageRules: combination.package_rules ?? undefined,
          displayOrder: combination.display_order,
          isActive: combination.is_active,
        })),
    );
  }
}
