"use client";

import { useEffect, useRef, useState } from "react";
import type { ComboPricingMode, TreatmentCombo } from "@/domain/treatment";
import { quoteCombo } from "@/lib/combo-quote";
import { formatDuration, formatPrice } from "@/lib/format";

interface Zone { id: string; reference_price_cents: number; duration_minutes: number }
export function ComboPricingFields({ mode: initialMode, fixedPrice, discount, tierItems, tierDiscount, zones }: {
  mode: ComboPricingMode; fixedPrice: number; discount: number; tierItems: number; tierDiscount: number; zones: Zone[];
}) {
  const [mode, setMode] = useState(initialMode);
  const root = useRef<HTMLDivElement>(null);
  const [estimate, setEstimate] = useState<ReturnType<typeof quoteCombo> | null>(null);
  useEffect(() => {
    const form = root.current?.closest("form");
    if (!form) return;
    const calculate = () => {
      const data = new FormData(form);
      const selected = zones.filter((zone) => data.getAll("zoneIds").includes(zone.id));
      const sessions = data.get("mode") === "package" ? Number(data.get("sessionCount")) : 1;
      const fixed = Number(data.get("fixedPricePesos")) * 100;
      if (!selected.length || !Number.isFinite(sessions) || sessions < 1) { setEstimate(null); return; }
      const combo: TreatmentCombo = {
        id: "preview", treatmentId: "preview", name: "", description: "", audience: "shared", mode: sessions > 1 ? "package" : "single_session",
        sessionCount: sessions, pricingMode: mode, fixedPriceCents: fixed, discountPercent: Number(data.get("discountPercent")),
        tierMinItems: Number(data.get("tierMinItems")), tierDiscountPercent: Number(data.get("tierDiscountPercent")),
        referencePriceCents: selected.reduce((sum, zone) => sum + zone.reference_price_cents, 0) * sessions,
        durationMinutes: selected.reduce((sum, zone) => sum + zone.duration_minutes, 0),
        zones: selected.map((zone) => ({ id: zone.id, name: "", audience: "shared", referencePriceCents: zone.reference_price_cents, durationMinutes: zone.duration_minutes, displayOrder: 0, isActive: true })),
        extras: [], allowPublicExtras: false, validityDays: null, displayOrder: 0, isActive: false, pricePerSessionCents: 0, savingsCents: 0,
      };
      setEstimate(quoteCombo(combo));
    };
    queueMicrotask(calculate);
    form.addEventListener("input", calculate);
    form.addEventListener("change", calculate);
    return () => { form.removeEventListener("input", calculate); form.removeEventListener("change", calculate); };
  }, [mode, zones]);
  return <div ref={root}>
    <div className="admin-form-grid">
      <label>Regla de precio<select name="pricingMode" value={mode} onChange={(event) => setMode(event.target.value as ComboPricingMode)}><option value="fixed_price">Precio final manual</option><option value="percentage_discount">Descuento porcentual</option><option value="tiered_discount">Descuento por cantidad</option></select></label>
      <label hidden={mode !== "fixed_price"}>Precio total del combo<input name="fixedPricePesos" type="number" min="1" step="1" defaultValue={fixedPrice || ""} required={mode === "fixed_price"} disabled={mode !== "fixed_price"} /></label>
      <label hidden={mode !== "percentage_discount"}>Descuento %<input name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={discount} required={mode === "percentage_discount"} disabled={mode !== "percentage_discount"} /></label>
      <label hidden={mode !== "tiered_discount"}>Cantidad mínima de zonas y extras<input name="tierMinItems" type="number" min="1" max="99" defaultValue={tierItems} required={mode === "tiered_discount"} disabled={mode !== "tiered_discount"} /></label>
      <label hidden={mode !== "tiered_discount"}>Descuento por cantidad %<input name="tierDiscountPercent" type="number" min="0" max="100" step="0.01" defaultValue={tierDiscount} required={mode === "tiered_discount"} disabled={mode !== "tiered_discount"} /></label>
    </div>
    <p className="admin-field-note numeric" aria-live="polite">{estimate ? <>Base sin extras: {formatPrice(estimate.priceCents)} · {formatPrice(estimate.pricePerSessionCents)} por sesión · ahorro {formatPrice(estimate.savingsCents)} · {formatDuration(estimate.durationMinutes)} por turno, sin preparación. Los extras elegidos por el público pueden cambiar el precio y activar el descuento por cantidad.</> : "Seleccioná zonas para previsualizar el valor del combo."}</p>
  </div>;
}
