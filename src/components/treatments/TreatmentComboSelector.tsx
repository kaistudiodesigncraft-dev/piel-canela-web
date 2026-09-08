"use client";

import { ArrowRight, CalendarClock, Check, CircleDollarSign, Layers3 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DepilationAudience, Treatment } from "@/domain/treatment";
import { formatDuration, formatPrice } from "@/lib/format";
import { buildBookingHref } from "@/lib/treatments";

const labels: Record<DepilationAudience, string> = { women: "Mujeres", men: "Hombres", shared: "Compartido" };
type Filter = "all" | DepilationAudience;

export function TreatmentComboSelector({ treatment }: { treatment: Treatment }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(() => treatment.combos.filter((combo) => combo.isActive && (filter === "all" || combo.audience === filter)), [filter, treatment.combos]);
  const selected = treatment.combos.find((combo) => combo.id === selectedId);

  return <section className="combo-selector" aria-labelledby={`combo-selector-${treatment.id}`}>
    <div className="combo-selector__heading"><div><p className="eyebrow">Opciones disponibles</p><h2 id={`combo-selector-${treatment.id}`}>Elegí un combo</h2><p>Los combos ya están armados por Piel Canela. Seleccioná uno para ver el resumen y buscar un horario.</p></div></div>
    <div className="combo-selector__filters" aria-label="Filtrar combos">
      {(["all", "women", "men", "shared"] as const).map((value) => <button key={value} type="button" className={`filter-chip${filter === value ? " is-active" : ""}`} aria-pressed={filter === value} onClick={() => { setFilter(value); if (value !== "all" && selected?.audience !== value) setSelectedId(null); }}>{value === "all" ? "Todos" : labels[value]}</button>)}
    </div>
    <div className="combo-selector__layout">
      <div className="combo-selector__options" role="radiogroup" aria-label="Combos publicados">
        {visible.length === 0 ? <p className="combo-selector__empty">No hay combos publicados para este filtro.</p> : visible.map((combo) => {
          const checked = combo.id === selectedId;
          return <label key={combo.id} className={`combo-option${checked ? " is-selected" : ""}`}>
            <input type="radio" name={`combo-${treatment.id}`} value={combo.id} checked={checked} onChange={() => setSelectedId(combo.id)} />
            <span className="combo-option__marker" aria-hidden="true">{checked ? <Check /> : null}</span>
            <span className="combo-option__body"><span className="combo-option__top"><strong>{combo.name}</strong><span>{labels[combo.audience]}</span></span>{combo.description ? <small>{combo.description}</small> : null}<span className="combo-option__zones">{combo.zones.map((zone) => zone.name).join(" · ")}</span><span className="combo-option__facts numeric"><span>{combo.mode === "package" ? `${combo.sessionCount} sesiones` : "1 sesión"}</span><span>{formatDuration(combo.durationMinutes + treatment.bufferMinutes)}</span><strong>{formatPrice(combo.fixedPriceCents)}</strong></span></span>
          </label>;
        })}
      </div>
      <aside className="combo-selection-summary" aria-live="polite">
        {selected ? <><span className="status-badge status-confirmed">{labels[selected.audience]}</span><h3>{selected.name}</h3><ul>{selected.zones.map((zone) => <li key={zone.id}><Check aria-hidden="true" />{zone.name}</li>)}</ul><dl className="numeric"><div><dt><CalendarClock aria-hidden="true" />Duración por turno</dt><dd>{formatDuration(selected.durationMinutes + treatment.bufferMinutes)}</dd></div><div><dt><Layers3 aria-hidden="true" />Sesiones</dt><dd>{selected.sessionCount}</dd></div>{selected.validityDays ? <div><dt>Vigencia</dt><dd>{selected.validityDays} días</dd></div> : null}<div><dt><CircleDollarSign aria-hidden="true" />Precio total</dt><dd>{formatPrice(selected.fixedPriceCents)}</dd></div>{selected.mode === "package" ? <div><dt>Por sesión</dt><dd>{formatPrice(selected.pricePerSessionCents)}</dd></div> : null}{selected.savingsCents > 0 ? <div className="combo-selection-summary__saving"><dt>Ahorro</dt><dd>{formatPrice(selected.savingsCents)}</dd></div> : null}</dl><Link className="button button--primary" href={buildBookingHref({ treatmentId: treatment.id, comboId: selected.id })}>Elegir fecha y horario<ArrowRight aria-hidden="true" /></Link><p className="combo-selection-summary__note">La pre-reserva agenda la primera sesión. El paquete se activa cuando recepción confirma la seña.</p></> : <div className="combo-selection-summary__placeholder"><Layers3 aria-hidden="true" /><h3>Seleccioná una opción</h3><p>Acá vas a ver precio, sesiones, vigencia y el acceso al calendario.</p></div>}
      </aside>
    </div>
  </section>;
}
