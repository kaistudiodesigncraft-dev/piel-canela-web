"use client";

import Link from "next/link";
import { useState } from "react";
import type { DepilationAudience, Treatment } from "@/domain/treatment";
import { DISCOUNT_MIN_ZONES } from "@/lib/depilation-order";
import { resolveZoneOrder } from "@/lib/depilation-selection";
import { formatDuration, formatPrice } from "@/lib/format";
import { buildBookingHref } from "@/lib/treatments";

const audienceLabels: Record<DepilationAudience, string> = {
  women: "Mujeres", men: "Hombres", shared: "Compartido",
};

/** The same zone catalog powers standalone selections and additions to a combo. */
export function DepilationOrderSelector({ treatment, preview = false }: {
  treatment: Treatment; preview?: boolean;
}) {
  const [comboId, setComboId] = useState<string>();
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | DepilationAudience>("all");
  const catalog = treatment.zoneOrder;
  if (!catalog?.ready) {
    return <section className="combo-selector" aria-label="Opciones de depilación">
      <h2>No pudimos cargar las zonas</h2>
      <p>Intentá nuevamente. No hace falta volver a cargar tratamientos ni precios.</p>
      <button className="button button--quiet" type="button" onClick={() => window.location.reload()}>Reintentar</button>
    </section>;
  }
  const combos = treatment.combos.filter(c => c.isActive && c.fixedPriceCents > 0);
  const selectedCombo = combos.find(c => c.id === comboId);
  const included = new Set(selectedCombo?.zones.map(z => z.id) ?? []);
  const visibleZones = catalog.zones.filter(z => z.isActive && z.referencePriceCents > 0 &&
    (filter === "all" || z.audience === filter));
  let selection = null;
  let selectionError = "";
  try {
    selection = comboId || zoneIds.length ? resolveZoneOrder(preview ? { ...treatment, isActive: true } : treatment, comboId, zoneIds) : null;
  } catch { selectionError = "No pudimos calcular esta combinación. Quitá la última zona o elegí otra propuesta."; }
  const order = selection?.orderSnapshot;
  function chooseCombo(id: string | undefined) {
    const next = combos.find(c => c.id === id);
    setComboId(id);
    setZoneIds(current => current.filter(zone => !next?.zones.some(z => z.id === zone)));
  }
  return <section className="combo-selector depilation-order" aria-labelledby={`order-${treatment.id}`}>
    <div className="combo-selector__heading"><div>
      <h2 id={`order-${treatment.id}`}>Elegí cómo querés depilarte</h2>
      <p>Podés elegir un combo, sumar zonas adicionales o seleccionar solo las zonas que necesitás.</p>
    </div></div>
    <div className="combo-selector__layout">
      <div className="combo-selector__options">
        <fieldset className="depilation-order__choices">
          <legend>Tu punto de partida</legend>
          <label className={`combo-option${!comboId ? " is-selected" : ""}`}>
            <input type="radio" name={`order-combo-${treatment.id}`} checked={!comboId} onChange={() => chooseCombo(undefined)} />
            <span className="combo-option__body"><strong>Elegir zonas sueltas</strong><small>Una zona o tu propia combinación.</small></span>
          </label>
          {combos.map(combo => <label key={combo.id} className={`combo-option${comboId === combo.id ? " is-selected" : ""}`}>
            <input type="radio" name={`order-combo-${treatment.id}`} checked={comboId === combo.id} onChange={() => chooseCombo(combo.id)} />
            <span className="combo-option__body">
              <span className="combo-option__top"><strong>{combo.name}</strong><span>{audienceLabels[combo.audience]}</span></span>
              <small>{combo.zones.map(z => z.name).join(" · ")}</small>
              <span className="combo-option__facts numeric"><span>{combo.sessionCount} {combo.sessionCount === 1 ? "sesión" : "sesiones"}</span><span>{formatDuration(combo.durationMinutes)}</span><strong>{formatPrice(combo.fixedPriceCents)}</strong></span>
            </span>
          </label>)}
        </fieldset>
        <fieldset className="depilation-order__choices">
          <legend>{selectedCombo ? "Zonas adicionales" : "Seleccioná tus zonas"}</legend>
          <div className="combo-selector__filters" aria-label="Filtrar zonas">
            {(["all", "women", "men", "shared"] as const).map(value => <button key={value} type="button"
              className={`filter-chip${filter === value ? " is-active" : ""}`} aria-pressed={filter === value}
              onClick={() => setFilter(value)}>{value === "all" ? "Todas" : audienceLabels[value]}</button>)}
          </div>
          {visibleZones.length === 0 ? <p>Todavía no hay zonas disponibles{filter !== "all" ? " para este filtro" : ""}.</p> : visibleZones.map(zone =>
            <label key={zone.id} className={`depilation-order__zone${included.has(zone.id) ? " is-included" : ""}`}>
              <input type="checkbox" checked={included.has(zone.id) || zoneIds.includes(zone.id)} disabled={included.has(zone.id)}
                onChange={event => setZoneIds(current => event.target.checked ? [...current, zone.id] : current.filter(id => id !== zone.id))} />
              <span><strong>{zone.name}</strong><small>{included.has(zone.id) ? "Incluida en el combo" : `${audienceLabels[zone.audience]} · ${formatDuration(zone.durationMinutes)}`}</small></span>
              <span className="numeric">{included.has(zone.id) ? "Incluida" : formatPrice(zone.referencePriceCents)}</span>
            </label>)}
        </fieldset>
      </div>
      <aside className="combo-selection-summary depilation-order__summary" aria-label="Resumen de tu elección">
        <h3>Tu elección</h3>
        <div aria-live="polite" aria-atomic="true">
          {order ? <><ul>{order.items.map(item => <li key={`${item.kind}-${item.id}`}>{item.name} · {formatPrice(item.priceCents)}</li>)}</ul>
            <dl className="numeric">
              <div><dt>Duración</dt><dd>{formatDuration(order.durationMinutes)}</dd></div>
              <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotalCents)}</dd></div>
              {order.discountCents > 0 ? <div><dt>Descuento en zonas ({order.discountPercent} %)</dt><dd>−{formatPrice(order.discountCents)}</dd></div> : null}
              <div><dt>Total</dt><dd>{formatPrice(order.totalCents)}</dd></div>
            </dl>
          </> : <p>Elegí al menos una zona o un combo para consultar horarios.</p>}
          {selectionError ? <p role="alert">{selectionError}</p> : null}
          {selectedCombo?.validityDays ? <p>Vigencia del paquete: {selectedCombo.validityDays} días desde su activación.</p> : null}
          {zoneIds.length === 1 && catalog.discountPercent > 0 ? <p className="combo-selection-summary__note">Desde {DISCOUNT_MIN_ZONES} zonas {selectedCombo ? "adicionales" : "sueltas"} tenés un {catalog.discountPercent} % de descuento sobre esas zonas. El combo conserva su precio.</p> : null}
        </div>
        {selection && !preview ? <Link className="button button--primary" href={buildBookingHref(selection)}>Elegir fecha y horario</Link> : <button type="button" className="button button--primary" disabled>{preview ? "Vista previa · sin reservar" : "Elegí una opción para continuar"}</button>}
        <p className="combo-selection-summary__note">La pre-reserva queda pendiente hasta confirmar la seña. No se acumula con Especiales del mes.</p>
      </aside>
    </div>
  </section>;
}
