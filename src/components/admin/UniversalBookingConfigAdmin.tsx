"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, LockKeyhole, Plus } from "lucide-react";
import {
  saveBookingCombination,
  saveBookingConfiguration,
  saveBookingOption,
} from "@/app/admin/catalogo/[id]/configuracion-reserva/actions";
import type { BookingConfig } from "@/lib/booking-config";
import {
  bookingModeDescriptions,
  bookingModeLabels,
  createDefaultBookingConfig,
  isLegacyConfigReadOnly,
  type BookingMode,
} from "@/lib/booking-config-editor";
import { calculateOrder } from "@/lib/booking-engine";
import { initialBookingConfigActionState, type BookingConfigActionState } from "@/lib/admin/booking-config-action-state";
import type {
  BookingConfigCombinationRow,
  BookingConfigOptionRow,
  BookingConfigTreatmentRow,
} from "@/lib/admin/booking-config-editor-types";
import { formatDuration, formatPrice } from "@/lib/format";
import { GenericCatalog } from "@/lib/option-catalog";
import { AdminSubmitButton } from "./AdminSubmitButton";

function ActionFeedback({ state }: { state: BookingConfigActionState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== "idle") ref.current?.focus();
  }, [state]);
  if (state.status === "idle") return null;
  const errors = Object.values(state.fieldErrors ?? {}).flat();
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={state.status === "saved" ? "status" : "alert"}
      className={`form-message${state.status === "saved" ? "" : " form-message--error"}`}
    >
      <strong>{state.message ?? (state.status === "saved" ? "Cambios guardados." : "Revisá los datos.")}</strong>
      {errors.length ? <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      {state.incidentId ? <small>Código de soporte: {state.incidentId}</small> : null}
    </div>
  );
}

function BookingConfigurationForm({ treatment }: { treatment: BookingConfigTreatmentRow }) {
  const [state, action] = useActionState(saveBookingConfiguration, initialBookingConfigActionState);
  const [config, setConfig] = useState<BookingConfig>(treatment.booking_config);
  const [enabled, setEnabled] = useState(treatment.config_enabled);

  function changeMode(mode: BookingMode) {
    setConfig(createDefaultBookingConfig({
      mode,
      priceCents: treatment.price_cents,
      durationMinutes: treatment.duration_minutes,
      previous: config,
    }));
    if (mode === "package") setEnabled(false);
  }

  function setSelectionMode(selectionMode: "single" | "multiple") {
    setConfig({
      ...config,
      selectionMode,
      minSelections: selectionMode === "single" ? Math.min(config.minSelections, 1) : config.minSelections,
      maxSelections: selectionMode === "single" ? 1 : config.maxSelections,
    } as BookingConfig);
  }

  const supportsOptions = config.mode === "options" || config.mode === "combos_with_addons";
  const supportsDiscount = supportsOptions;

  return (
    <form action={action} className="admin-form universal-booking-config__form">
      <input type="hidden" name="treatmentId" value={treatment.id} />
      <input type="hidden" name="expectedUpdatedAt" value={treatment.updated_at} />
      <input type="hidden" name="bookingConfigJson" value={JSON.stringify(config)} />
      <fieldset>
        <legend>Forma de reserva</legend>
        <p className="admin-fieldset-intro">Elegí cómo se arma el servicio. La agenda y los profesionales continúan en la ficha principal.</p>
        <div className="booking-mode-grid" role="radiogroup" aria-label="Modalidad de reserva">
          {(Object.keys(bookingModeLabels) as BookingMode[]).map((mode) => {
            const packagePending = mode === "package";
            return (
              <label key={mode} className={`booking-mode-option${config.mode === mode ? " is-selected" : ""}${packagePending ? " is-pending" : ""}`}>
                <input
                  type="radio"
                  name="mode"
                  value={mode}
                  checked={config.mode === mode}
                  disabled={packagePending && config.mode !== "package"}
                  onChange={() => changeMode(mode)}
                />
                <span><strong>{bookingModeLabels[mode]}</strong><small>{bookingModeDescriptions[mode]}</small>{packagePending ? <em>Release de paquetes</em> : null}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {config.mode !== "simple" && config.mode !== "package" ? (
        <fieldset>
          <legend>Opciones y selección</legend>
          <div className="admin-form-grid">
            <label>Nombre singular
              <input value={config.optionsLabel.singular} maxLength={40} onChange={(event) => setConfig({ ...config, optionsLabel: { ...config.optionsLabel, singular: event.target.value } })} />
              <small>Ejemplo: zona, sesión, área.</small>
            </label>
            <label>Nombre plural
              <input value={config.optionsLabel.plural} maxLength={40} onChange={(event) => setConfig({ ...config, optionsLabel: { ...config.optionsLabel, plural: event.target.value } })} />
            </label>
          </div>
          {supportsOptions ? <div className="admin-form-grid admin-form-grid--3">
            <label>Tipo de selección
              <select value={config.selectionMode} onChange={(event) => setSelectionMode(event.target.value as "single" | "multiple")}>
                <option value="single">Una opción</option>
                <option value="multiple">Varias opciones</option>
              </select>
            </label>
            <label>Mínimo
              <input type="number" min="0" max="100" value={config.minSelections} onChange={(event) => setConfig({ ...config, minSelections: Math.max(0, Number(event.target.value)) } as BookingConfig)} />
            </label>
            <label>Máximo opcional
              <input type="number" min="0" max="100" value={config.maxSelections ?? ""} onChange={(event) => setConfig({ ...config, maxSelections: event.target.value === "" ? null : Number(event.target.value) } as BookingConfig)} />
            </label>
          </div> : null}
          {config.mode === "options" ? <label className="admin-check"><input type="checkbox" checked={config.allowCombos} onChange={(event) => setConfig({ ...config, allowCombos: event.target.checked } as BookingConfig)} /><span><strong>También permitir propuestas cerradas</strong><small>Las opciones sueltas siguen disponibles.</small></span></label> : null}
          {config.mode === "combos_with_addons" ? <label className="admin-check"><input type="checkbox" checked={config.allowLooseOptions} onChange={(event) => setConfig({ ...config, allowLooseOptions: event.target.checked } as BookingConfig)} /><span><strong>Permitir opciones sin elegir un combo</strong><small>Si se desactiva, siempre será obligatorio elegir un combo.</small></span></label> : null}
        </fieldset>
      ) : null}

      {supportsDiscount ? <fieldset>
        <legend>Precio</legend>
        <label>Regla de precio
          <select value={config.priceRule.type} onChange={(event) => {
            const type = event.target.value;
            if (type === "sum_with_volume_discount") {
              setConfig({ ...config, priceRule: { type, minOptions: 2, discountPercent: 0, appliesTo: "loose_options_only" } } as BookingConfig);
            } else if (config.mode === "combos_with_addons") {
              setConfig({ ...config, priceRule: { type: "combo_price" } } as BookingConfig);
            } else {
              setConfig({ ...config, priceRule: { type: "sum_of_options" } } as BookingConfig);
            }
          }}>
            {config.mode === "options" ? <option value="sum_of_options">Sumar opciones, sin descuento</option> : <option value="combo_price">Precio del combo + adicionales</option>}
            <option value="sum_with_volume_discount">Descuento por cantidad sobre opciones sueltas</option>
          </select>
        </label>
        {config.priceRule.type === "sum_with_volume_discount" ? <div className="admin-form-grid">
          <label>Cantidad mínima para descuento<input type="number" min="1" max="100" value={config.priceRule.minOptions} onChange={(event) => setConfig({ ...config, priceRule: { ...config.priceRule, minOptions: Number(event.target.value) } } as BookingConfig)} /></label>
          <label>Descuento porcentual<input type="number" min="0" max="100" step="0.1" value={config.priceRule.discountPercent} onChange={(event) => setConfig({ ...config, priceRule: { ...config.priceRule, discountPercent: Number(event.target.value) } } as BookingConfig)} /></label>
        </div> : null}
        <p className="admin-field-note">El descuento, si existe, se aplica únicamente a las opciones sueltas o adicionales. Nunca modifica el precio propio del combo.</p>
      </fieldset> : null}

      <fieldset>
        <legend>Condiciones</legend>
        <label>Aclaraciones opcionales<textarea rows={4} maxLength={2000} value={config.conditionsText ?? ""} onChange={(event) => setConfig({ ...config, conditionsText: event.target.value || null })} /><small>Solo agrega información. No reemplaza las reglas calculadas por el sistema.</small></label>
      </fieldset>

      <div className="admin-activation-panel">
        <label className="admin-check"><input name="configEnabled" type="checkbox" checked={enabled} disabled={config.mode === "package"} onChange={(event) => setEnabled(event.target.checked)} /><span><strong>Habilitar este circuito configurable</strong><small>Solo habilitalo cuando las opciones o propuestas estén completas y verificadas.</small></span></label>
        {treatment.total_booking_count > 0 ? <label className="admin-impact-check"><input name="confirmImpact" type="checkbox" /><span><strong>{treatment.total_booking_count} reservas registradas.</strong> Confirmo que revisé el impacto. Las reservas existentes no se modificarán.</span></label> : null}
      </div>
      <ActionFeedback state={state} />
      <div className="admin-form-footer"><p>Guardar no cambia las reservas existentes ni activa el flujo público por sí solo.</p><AdminSubmitButton pendingLabel="Guardando…">Guardar configuración</AdminSubmitButton></div>
    </form>
  );
}

function BookingOptionForm({ treatmentId, option }: { treatmentId: string; option?: BookingConfigOptionRow }) {
  const [state, action] = useActionState(saveBookingOption, initialBookingConfigActionState);
  const prefix = option ? `option-${option.id}` : "new-option";
  return <form action={action} className="admin-form booking-catalog-form">
    <input type="hidden" name="treatmentId" value={treatmentId} />
    {option ? <><input type="hidden" name="optionId" value={option.id} /><input type="hidden" name="expectedUpdatedAt" value={option.updated_at} /></> : null}
    <div className="admin-form-grid admin-form-grid--3">
      <label htmlFor={`${prefix}-name`}>Nombre<input id={`${prefix}-name`} name="name" defaultValue={option?.name ?? ""} required maxLength={120} /></label>
      <label htmlFor={`${prefix}-price`}>Precio en pesos<input id={`${prefix}-price`} name="pricePesos" type="number" min="0" step="1" defaultValue={option ? option.price_cents / 100 : ""} required /></label>
      <label htmlFor={`${prefix}-duration`}>Duración<input id={`${prefix}-duration`} name="durationMinutes" type="number" min="1" max="1440" defaultValue={option?.duration_minutes ?? 30} required /></label>
    </div>
    <label htmlFor={`${prefix}-description`}>Descripción opcional<textarea id={`${prefix}-description`} name="description" rows={2} maxLength={500} defaultValue={option?.description ?? ""} /></label>
    <div className="admin-form-grid">
      <label htmlFor={`${prefix}-order`}>Orden<input id={`${prefix}-order`} name="displayOrder" type="number" min="0" max="9999" defaultValue={option?.display_order ?? 0} required /></label>
      <label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={option?.is_active ?? false} /><span><strong>Disponible</strong><small>Si la pausás, no se ofrece en nuevas reservas.</small></span></label>
    </div>
    <ActionFeedback state={state} />
    <div className="admin-form-footer"><p>{option ? "Los cambios futuros no alteran snapshots ya guardados." : "Se crea primero como borrador salvo que marques Disponible."}</p><AdminSubmitButton pendingLabel="Guardando…">{option ? "Guardar opción" : "Crear opción"}</AdminSubmitButton></div>
  </form>;
}

function BookingCombinationForm({ treatmentId, combination, options, mode }: {
  treatmentId: string;
  combination?: BookingConfigCombinationRow;
  options: BookingConfigOptionRow[];
  mode: BookingMode;
}) {
  const [state, action] = useActionState(saveBookingCombination, initialBookingConfigActionState);
  const [included, setIncluded] = useState(combination?.included_option_ids ?? []);
  const [addons, setAddons] = useState(combination?.addon_option_ids ?? []);
  const prefix = combination ? `combination-${combination.id}` : "new-combination";
  const allowAddons = mode === "combos_with_addons";
  const kind = mode === "package" ? "package" : "combo";
  return <form action={action} className="admin-form booking-catalog-form">
    <input type="hidden" name="treatmentId" value={treatmentId} />
    <input type="hidden" name="kind" value={kind} />
    {combination ? <><input type="hidden" name="combinationId" value={combination.id} /><input type="hidden" name="expectedUpdatedAt" value={combination.updated_at} /></> : null}
    <div className="admin-form-grid admin-form-grid--3">
      <label htmlFor={`${prefix}-name`}>Nombre<input id={`${prefix}-name`} name="name" defaultValue={combination?.name ?? ""} required maxLength={120} /></label>
      <label htmlFor={`${prefix}-price`}>Precio en pesos<input id={`${prefix}-price`} name="pricePesos" type="number" min="0" step="1" defaultValue={combination ? combination.price_cents / 100 : ""} required /></label>
      <label htmlFor={`${prefix}-duration`}>Duración por turno<input id={`${prefix}-duration`} name="durationMinutes" type="number" min="1" max="1440" defaultValue={combination?.duration_minutes ?? 30} required /></label>
    </div>
    <label htmlFor={`${prefix}-description`}>Descripción opcional<textarea id={`${prefix}-description`} name="description" rows={2} maxLength={500} defaultValue={combination?.description ?? ""} /></label>
    <fieldset className="depilation-zone-picker"><legend>Opciones incluidas</legend>{options.length === 0 ? <p className="admin-field-note">Creá al menos una opción antes de armar una propuesta.</p> : options.map((option) => <label className="admin-check" key={option.id}><input name="includedOptionIds" value={option.id} type="checkbox" checked={included.includes(option.id)} disabled={addons.includes(option.id)} onChange={(event) => setIncluded((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} /><span><strong>{option.name}</strong><small>{formatPrice(option.price_cents)} · {formatDuration(option.duration_minutes)}{option.is_active ? "" : " · Borrador"}</small></span></label>)}</fieldset>
    {allowAddons ? <fieldset className="depilation-zone-picker"><legend>Adicionales permitidos</legend>{options.map((option) => <label className="admin-check" key={option.id}><input name="addonOptionIds" value={option.id} type="checkbox" checked={addons.includes(option.id)} disabled={included.includes(option.id)} onChange={(event) => setAddons((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} /><span><strong>{option.name}</strong><small>{included.includes(option.id) ? "Ya está incluida" : "Puede sumarse como adicional"}</small></span></label>)}</fieldset> : null}
    <div className="admin-form-grid admin-form-grid--3">
      <label htmlFor={`${prefix}-sessions`}>Sesiones<input id={`${prefix}-sessions`} name="sessionCount" type="number" min="1" max="100" defaultValue={combination?.session_count ?? 1} readOnly={kind !== "package"} /></label>
      <label htmlFor={`${prefix}-order`}>Orden<input id={`${prefix}-order`} name="displayOrder" type="number" min="0" max="9999" defaultValue={combination?.display_order ?? 0} required /></label>
      <label className="admin-check"><input name="isActive" type="checkbox" defaultChecked={combination?.is_active ?? false} /><span><strong>Disponible</strong><small>Debe usar opciones activas.</small></span></label>
    </div>
    <ActionFeedback state={state} />
    <div className="admin-form-footer"><p>No se eliminan propuestas: podés pausarlas conservando su historial.</p><AdminSubmitButton pendingLabel="Guardando…" disabled={options.length === 0}>{combination ? "Guardar propuesta" : "Crear propuesta"}</AdminSubmitButton></div>
  </form>;
}

function BookingConfigSimulator({ treatmentId, config, options, combinations }: {
  treatmentId: string;
  config: BookingConfig;
  options: BookingConfigOptionRow[];
  combinations: BookingConfigCombinationRow[];
}) {
  const activeOptions = options.filter((option) => option.is_active);
  const activeCombinations = combinations.filter((combination) => combination.is_active);
  const [combinationId, setCombinationId] = useState("");
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const catalog = useMemo(() => new GenericCatalog(
    treatmentId,
    activeOptions,
    activeCombinations.map((combination) => ({
      id: combination.id,
      treatment_id: combination.treatment_id,
      name: combination.name,
      kind: combination.kind,
      price_cents: combination.price_cents,
      duration_minutes: combination.duration_minutes,
      included_option_ids: combination.included_option_ids,
      allowed_addon_option_ids: combination.addon_option_ids,
      session_count: combination.session_count,
      display_order: combination.display_order,
      is_active: combination.is_active,
    })),
  ), [activeCombinations, activeOptions, treatmentId]);
  let result: ReturnType<typeof calculateOrder> | null = null;
  let issue: string | null = null;
  try {
    result = calculateOrder(config, catalog, { combinationId: combinationId || null, optionIds });
  } catch (error) {
    issue = error instanceof Error ? error.message : "selection_invalid";
  }
  const showsCombinations = config.allowCombos;
  const showsOptions = config.allowLooseOptions || (config.allowAddons && Boolean(combinationId));

  return <section className="booking-config-simulator" aria-labelledby="booking-config-simulator-title">
    <div><p className="eyebrow">Simulador interno</p><h2 id="booking-config-simulator-title">Comprobá la experiencia antes de habilitarla</h2><p>Usa el mismo motor de precio y duración del servidor. No crea reservas.</p></div>
    {showsCombinations ? <label>Propuesta<select value={combinationId} onChange={(event) => { setCombinationId(event.target.value); setOptionIds([]); }}><option value="">Sin propuesta</option>{activeCombinations.map((combination) => <option key={combination.id} value={combination.id}>{combination.name}</option>)}</select></label> : null}
    {showsOptions ? <fieldset className="depilation-zone-picker"><legend>{config.optionsLabel.plural}</legend>{activeOptions.length === 0 ? <p className="admin-field-note">Todavía no hay opciones activas.</p> : activeOptions.map((option) => {
      const selectedCombination = activeCombinations.find((item) => item.id === combinationId);
      const included = selectedCombination?.included_option_ids.includes(option.id) ?? false;
      const allowed = !selectedCombination || selectedCombination.addon_option_ids.includes(option.id);
      return <label className="admin-check" key={option.id}><input type="checkbox" checked={optionIds.includes(option.id)} disabled={included || !allowed} onChange={(event) => setOptionIds((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))} /><span><strong>{option.name}</strong><small>{included ? "Incluida en la propuesta" : `${formatPrice(option.price_cents)} · ${formatDuration(option.duration_minutes)}`}</small></span></label>;
    })}</fieldset> : null}
    {result ? <div className="booking-config-simulator__summary" role="status"><div><span>Subtotal</span><strong>{formatPrice(result.subtotalCents)}</strong></div>{result.discountCents > 0 ? <div><span>Descuento {result.discountPercent}%</span><strong>− {formatPrice(result.discountCents)}</strong></div> : null}<div><span>Duración</span><strong>{formatDuration(result.durationMinutes)}</strong></div><div className="is-total"><span>Total</span><strong>{formatPrice(result.totalCents)}</strong></div></div> : <p className="admin-field-note"><AlertCircle aria-hidden="true" />{issue === "selection_required" || issue === "combination_required" ? "Elegí una opción o propuesta para calcular." : "Completá una selección válida para ver el resultado."}</p>}
  </section>;
}

export function UniversalBookingConfigAdmin({ treatment, options, combinations }: {
  treatment: BookingConfigTreatmentRow;
  options: BookingConfigOptionRow[];
  combinations: BookingConfigCombinationRow[];
}) {
  const locked = isLegacyConfigReadOnly({ configEnabled: treatment.config_enabled, legacySelectionMode: treatment.selection_mode });
  if (locked) return <section className="admin-form universal-booking-config__locked"><LockKeyhole aria-hidden="true" /><div><h2>Circuito histórico protegido</h2><p>Este tratamiento conserva sus zonas, combos, reglas y reservas actuales. No se convierte automáticamente ni se copian sus datos al catálogo nuevo.</p><a className="button button--quiet" href={`/admin/catalogo/${treatment.id}/combos`}>Abrir configuración histórica</a></div></section>;

  const mode = treatment.booking_config.mode;
  const catalogVisible = mode !== "simple" && mode !== "package";
  const combinationsVisible = mode === "closed_combos" || mode === "combos_with_addons" || (mode === "options" && treatment.booking_config.allowCombos);
  return <div className="universal-booking-config">
    {!treatment.configuration_valid ? <p className="form-message form-message--error" role="alert"><strong>La configuración guardada no es válida.</strong> Corregila antes de habilitar el circuito.</p> : null}
    <BookingConfigurationForm treatment={treatment} />
    {catalogVisible ? <section className="universal-booking-config__catalog" aria-labelledby="booking-options-title">
      <div className="section-heading"><div><p className="eyebrow">Catálogo configurable</p><h2 id="booking-options-title">{treatment.booking_config.optionsLabel.plural}</h2><p>Creá cada elemento una sola vez. Pausarlo conserva su historial.</p></div><Plus aria-hidden="true" /></div>
      <BookingOptionForm treatmentId={treatment.id} />
      {options.map((option) => <details key={option.id} className="admin-editable-item"><summary><span><strong>{option.name}</strong><small>{formatPrice(option.price_cents)} · {formatDuration(option.duration_minutes)}</small></span><span className={`status-badge status-${option.is_active ? "confirmed" : "expired"}`}>{option.is_active ? "Disponible" : "Borrador"}</span></summary><BookingOptionForm treatmentId={treatment.id} option={option} /></details>)}
    </section> : null}
    {combinationsVisible ? <section className="universal-booking-config__catalog" aria-labelledby="booking-combinations-title">
      <div className="section-heading"><div><p className="eyebrow">Propuestas</p><h2 id="booking-combinations-title">Combos configurados</h2><p>El precio y la duración propios quedan congelados en cada reserva.</p></div><Check aria-hidden="true" /></div>
      <BookingCombinationForm treatmentId={treatment.id} options={options} mode={mode} />
      {combinations.map((combination) => <details key={combination.id} className="admin-editable-item"><summary><span><strong>{combination.name}</strong><small>{formatPrice(combination.price_cents)} · {formatDuration(combination.duration_minutes)}</small></span><span className={`status-badge status-${combination.is_active ? "confirmed" : "expired"}`}>{combination.is_active ? "Disponible" : "Borrador"}</span></summary><BookingCombinationForm treatmentId={treatment.id} combination={combination} options={options} mode={mode} /></details>)}
    </section> : null}
    <BookingConfigSimulator treatmentId={treatment.id} config={treatment.booking_config} options={options} combinations={combinations} />
  </div>;
}
