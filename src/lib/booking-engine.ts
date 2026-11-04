import type { BookingConfig } from "./booking-config";
import type { CatalogCombination, CatalogOption, OptionCatalog } from "./option-catalog";

export interface BookingSelection {
  combinationId?: string | null;
  optionIds: readonly string[];
}

export interface BookingOrderItem {
  id: string;
  kind: "combination" | "option";
  name: string;
  priceCents: number;
  durationMinutes: number;
}

export interface BookingOrder {
  items: readonly BookingOrderItem[];
  subtotalCents: number;
  looseOptionsSubtotalCents: number;
  discountPercent: number;
  discountCents: number;
  totalCents: number;
  durationMinutes: number;
}

export interface ValidatedBookingSelection {
  combination: CatalogCombination | null;
  options: readonly CatalogOption[];
}

function assertMoney(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("invalid_price");
}

function assertDuration(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("invalid_duration");
}

function wholeArsDiscount(subtotalCents: number, percent: number) {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("invalid_discount");
  const basisPoints = Math.round(percent * 100);
  return Math.min(
    subtotalCents,
    Number((BigInt(subtotalCents) * BigInt(basisPoints) + BigInt(500_000)) / BigInt(1_000_000)) * 100,
  );
}

export function validateSelection(
  config: BookingConfig,
  catalog: OptionCatalog,
  selection: BookingSelection,
): ValidatedBookingSelection {
  if (new Set(selection.optionIds).size !== selection.optionIds.length) throw new Error("duplicate_option");

  const combination = selection.combinationId
    ? catalog.getCombination(selection.combinationId) ?? null
    : null;
  if (selection.combinationId && (!combination || !combination.isActive)) throw new Error("combination_unavailable");

  const options = selection.optionIds.map((id) => {
    const option = catalog.getOption(id);
    if (!option || !option.isActive) throw new Error("option_unavailable");
    return option;
  });
  if (combination && options.some((option) => combination.includedOptionIds.includes(option.id))) {
    throw new Error("option_already_in_combination");
  }

  if (options.length < config.minSelections) throw new Error("too_few_options");
  if (config.maxSelections !== null && options.length > config.maxSelections) throw new Error("too_many_options");
  if (config.selectionMode === "single" && options.length > 1) throw new Error("too_many_options");

  switch (config.mode) {
    case "simple":
      if (combination || options.length) throw new Error("selection_not_allowed");
      break;
    case "options":
      if (!options.length && !combination) throw new Error("selection_required");
      if (combination && !config.allowCombos) throw new Error("combination_not_allowed");
      if (combination && combination.kind !== "combo") throw new Error("invalid_combination_kind");
      if (combination && options.length) throw new Error("addons_not_allowed");
      break;
    case "closed_combos":
      if (!combination) throw new Error("combination_required");
      if (options.length) throw new Error("loose_options_not_allowed");
      if (combination.kind !== "combo") throw new Error("invalid_combination_kind");
      break;
    case "combos_with_addons":
      if (!combination && !config.allowLooseOptions) throw new Error("combination_required");
      if (!combination && options.length === 0) throw new Error("selection_required");
      if (combination?.kind !== undefined && combination.kind !== "combo") throw new Error("invalid_combination_kind");
      if (combination && options.length && combination.allowedAddonOptionIds !== null &&
        options.some((option) => !combination.allowedAddonOptionIds?.includes(option.id))) {
        throw new Error("addon_not_allowed");
      }
      break;
    case "package":
      if (!combination || combination.kind !== "package") throw new Error("package_required");
      if (options.length) throw new Error("loose_options_not_allowed");
      break;
  }

  return { combination, options };
}

export function calculateOrder(
  config: BookingConfig,
  catalog: OptionCatalog,
  selection: BookingSelection,
): BookingOrder {
  const { combination, options } = validateSelection(config, catalog, selection);
  const items: BookingOrderItem[] = [
    ...(combination ? [{
      id: combination.id,
      kind: "combination" as const,
      name: combination.name,
      priceCents: combination.priceCents,
      durationMinutes: combination.durationMinutes,
    }] : []),
    ...options.map((option) => ({
      id: option.id,
      kind: "option" as const,
      name: option.name,
      priceCents: option.priceCents,
      durationMinutes: option.durationMinutes,
    })),
  ];
  for (const item of items) {
    assertMoney(item.priceCents);
    assertDuration(item.durationMinutes);
  }

  const looseOptionsSubtotalCents = options.reduce((sum, option) => sum + option.priceCents, 0);
  const combinationSubtotalCents = combination?.priceCents ?? 0;
  let subtotalCents = combinationSubtotalCents + looseOptionsSubtotalCents;
  let discountPercent = 0;
  let discountCents = 0;

  switch (config.priceRule.type) {
    case "fixed":
      subtotalCents = config.priceRule.priceCents;
      break;
    case "sum_of_options":
    case "combo_price":
    case "package_price":
      break;
    case "sum_with_volume_discount":
      if (options.length >= config.priceRule.minOptions) {
        discountPercent = config.priceRule.discountPercent;
        discountCents = wholeArsDiscount(looseOptionsSubtotalCents, discountPercent);
      }
      break;
  }
  assertMoney(subtotalCents);
  if (subtotalCents > 2_147_483_647) throw new Error("order_total_too_large");

  let durationMinutes: number;
  switch (config.durationRule.type) {
    case "fixed":
      durationMinutes = config.durationRule.durationMinutes;
      break;
    case "per_session":
      durationMinutes = config.durationRule.durationMinutes;
      break;
    case "sum_of_options":
      durationMinutes = combination
        ? combination.durationMinutes
        : options.reduce((sum, option) => sum + option.durationMinutes, 0);
      break;
    case "combo_plus_addons":
      durationMinutes = (combination?.durationMinutes ?? 0) + options.reduce((sum, option) => sum + option.durationMinutes, 0);
      break;
  }
  assertDuration(durationMinutes);

  return {
    items,
    subtotalCents,
    looseOptionsSubtotalCents,
    discountPercent,
    discountCents,
    totalCents: subtotalCents - discountCents,
    durationMinutes,
  };
}
