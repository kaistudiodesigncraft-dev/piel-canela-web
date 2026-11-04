"use client";

import { Check, Clock3 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Treatment } from "@/domain/treatment";
import { calculateOrder } from "@/lib/booking-engine";
import { GenericCatalog } from "@/lib/option-catalog";
import { formatDuration, formatPrice } from "@/lib/format";
import { buildConfiguredBookingHref } from "@/lib/treatments";

function createCatalog(treatment: Treatment) {
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
      display_order: combination.displayOrder,
      is_active: combination.isActive,
    })),
  );
}

export function ConfigurableBookingSelector({ treatment, preview = false }: {
  treatment: Treatment;
  preview?: boolean;
}) {
  const searchParams = useSearchParams();
  const config = treatment.bookingConfig;
  const catalog = useMemo(() => createCatalog(treatment), [treatment]);
  const combinations = catalog.listCombinations().filter((item) => item.isActive && item.kind === "combo");
  const options = catalog.listOptions().filter((item) => item.isActive);
  const [combinationId, setCombinationId] = useState<string | null>(() => {
    const requested = searchParams.get("combinationId");
    return combinations.some((item) => item.id === requested) ? requested : null;
  });
  const [optionIds, setOptionIds] = useState<string[]>(() => [
    ...new Set(searchParams.getAll("optionId")),
  ].filter((id) => options.some((item) => item.id === id)));

  if (!config) return null;
  const activeConfig = config;
  const selectedCombination = combinationId ? catalog.getCombination(combinationId) : undefined;
  const included = new Set(selectedCombination?.includedOptionIds ?? []);
  const allowed = selectedCombination?.allowedAddonOptionIds;
  const canChooseLoose = config.mode === "options" || (config.mode === "combos_with_addons" && config.allowLooseOptions);
  const showOptions = config.mode === "options"
    ? !selectedCombination
    : config.mode === "combos_with_addons";
  const visibleOptions = showOptions ? options.filter((option) => {
    if (!selectedCombination) return config.allowLooseOptions;
    if (included.has(option.id)) return false;
    return allowed === null || allowed?.includes(option.id);
  }) : [];
  const reachedMaximum = config.maxSelections !== null && optionIds.length >= config.maxSelections;

  let order = null;
  let selectionMessage = "";
  try {
    order = calculateOrder(config, catalog, { combinationId, optionIds });
  } catch {
    if (config.mode === "closed_combos" || (!canChooseLoose && config.allowCombos)) {
      selectionMessage = "Elegí una propuesta para continuar.";
    } else if (optionIds.length < config.minSelections) {
      selectionMessage = `Elegí al menos ${config.minSelections} ${config.minSelections === 1 ? config.optionsLabel.singular : config.optionsLabel.plural}.`;
    } else {
      selectionMessage = `Revisá las ${config.optionsLabel.plural} seleccionadas.`;
    }
  }

  function chooseCombination(nextId: string | null) {
    const next = nextId ? catalog.getCombination(nextId) : undefined;
    setCombinationId(nextId);
    if (!next || activeConfig.mode === "options") {
      setOptionIds([]);
      return;
    }
    const nextIncluded = new Set(next.includedOptionIds);
    setOptionIds((current) => current.filter((id) =>
      !nextIncluded.has(id) && (next.allowedAddonOptionIds === null || next.allowedAddonOptionIds.includes(id)),
    ));
  }

  function toggleOption(optionId: string, checked: boolean) {
    if (activeConfig.selectionMode === "single") {
      setOptionIds(checked ? [optionId] : []);
      return;
    }
    setOptionIds((current) => checked
      ? [...new Set([...current, optionId])]
      : current.filter((id) => id !== optionId));
  }

  return <section id="opciones" className="combo-selector depilation-order configurable-booking-selector" aria-labelledby={`configured-${treatment.id}`}>
    <div className="combo-selector__heading"><div>
      <p className="eyebrow">Armá tu reserva</p>
      <h2 id={`configured-${treatment.id}`}>Elegí {config.optionsLabel.plural}</h2>
      <p>Seleccioná una propuesta preparada o elegí únicamente lo que necesitás. El resumen se actualiza antes de abrir el calendario.</p>
    </div></div>
    <div className="combo-selector__layout">
      <div className="combo-selector__options">
        {config.allowCombos ? <fieldset className="depilation-order__choices depilation-order__panel">
          <legend>Propuestas disponibles</legend>
          {canChooseLoose ? <label className={`combo-option${!combinationId ? " is-selected" : ""}`}>
            <input type="radio" name={`configured-combination-${treatment.id}`} checked={!combinationId} onChange={() => chooseCombination(null)} />
            <span className="combo-option__body"><strong>Elegir {config.optionsLabel.plural}</strong><small>Armá una selección sin propuesta.</small></span>
          </label> : null}
          {combinations.map((combination) => {
            const checked = combination.id === combinationId;
            const includedNames = combination.includedOptionIds
              .map((id) => catalog.getOption(id)?.name)
              .filter((name): name is string => Boolean(name));
            return <label key={combination.id} className={`combo-option${checked ? " is-selected" : ""}`}>
              <input type="radio" name={`configured-combination-${treatment.id}`} value={combination.id} checked={checked} onChange={() => chooseCombination(combination.id)} />
              <span className="combo-option__marker" aria-hidden="true">{checked ? <Check /> : null}</span>
              <span className="combo-option__body">
                <strong>{combination.name}</strong>
                {includedNames.length ? <small>{includedNames.join(" · ")}</small> : null}
                <span className="combo-option__facts numeric"><span>{formatDuration(combination.durationMinutes)}</span><strong>{formatPrice(combination.priceCents)}</strong></span>
              </span>
            </label>;
          })}
          {combinations.length === 0 ? <p className="combo-selector__empty">Todavía no hay propuestas publicadas.</p> : null}
        </fieldset> : null}

        {showOptions ? <fieldset className="depilation-order__choices depilation-order__panel">
          <legend>{selectedCombination ? `${config.optionsLabel.plural} adicionales` : config.optionsLabel.plural}</legend>
          <p className="depilation-order__intro">{selectedCombination ? "Solo aparecen las opciones compatibles que no están incluidas." : `Elegí ${config.minSelections > 0 ? `al menos ${config.minSelections}` : "una o más"}.`}</p>
          {visibleOptions.map((option) => {
            const checked = optionIds.includes(option.id);
            return <label key={option.id} className="depilation-order__zone">
              <input
                type={config.selectionMode === "single" ? "radio" : "checkbox"}
                name={config.selectionMode === "single" ? `configured-option-${treatment.id}` : undefined}
                checked={checked}
                disabled={!checked && reachedMaximum}
                onChange={(event) => toggleOption(option.id, event.target.checked)}
              />
              <span><strong>{option.name}</strong><small>{formatDuration(option.durationMinutes)}</small></span>
              <span className="numeric">{formatPrice(option.priceCents)}</span>
            </label>;
          })}
          {visibleOptions.length === 0 ? <p className="combo-selector__empty">No hay {config.optionsLabel.plural} adicionales disponibles para esta elección.</p> : null}
          {config.maxSelections !== null ? <p className="combo-selection-summary__note">Máximo: {config.maxSelections} {config.optionsLabel.plural}.</p> : null}
        </fieldset> : null}
      </div>

      <aside className="combo-selection-summary depilation-order__summary" aria-label="Resumen de tu elección">
        <h3>Tu elección</h3>
        <div aria-live="polite" aria-atomic="true">
          {order ? <>
            <ul>{order.items.map((item) => <li key={`${item.kind}-${item.id}`}>{item.name} · {formatPrice(item.priceCents)}</li>)}</ul>
            <dl className="numeric">
              <div><dt><Clock3 aria-hidden="true" />Duración</dt><dd>{formatDuration(order.durationMinutes)}</dd></div>
              <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 ? <div><dt>Descuento ({order.discountPercent} %)</dt><dd>−{formatPrice(order.discountCents)}</dd></div> : null}
              <div><dt>Total</dt><dd>{formatPrice(order.totalCents)}</dd></div>
            </dl>
          </> : <p>{selectionMessage}</p>}
          {config.priceRule.type === "sum_with_volume_discount" && optionIds.length > 0 && optionIds.length < config.priceRule.minOptions && config.priceRule.discountPercent > 0
            ? <p className="combo-selection-summary__note">Desde {config.priceRule.minOptions} {config.optionsLabel.plural} se aplica un {config.priceRule.discountPercent} % de descuento sobre esas opciones.</p>
            : null}
          {config.conditionsText ? <p className="combo-selection-summary__note">{config.conditionsText}</p> : null}
        </div>
        {order && !preview ? <Link className="button button--primary" href={buildConfiguredBookingHref({
          treatmentId: treatment.id,
          combinationId,
          optionIds,
        })}>Elegir fecha y horario</Link> : <button type="button" className="button button--primary" disabled>{preview ? "Vista previa · sin reservar" : "Completá tu elección"}</button>}
        <p className="combo-selection-summary__note">La pre-reserva queda pendiente hasta que recepción confirme la seña.</p>
      </aside>
    </div>
  </section>;
}
