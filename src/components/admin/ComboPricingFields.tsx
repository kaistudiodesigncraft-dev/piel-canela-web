"use client";

import { useEffect, useRef, useState } from "react";
import type { ComboPricingMode, TreatmentCombo } from "@/domain/treatment";
import { quoteCombo } from "@/lib/combo-quote";
import { calculateOrderTotal } from "@/lib/depilation-order";
import { formatDuration, formatPrice } from "@/lib/format";

interface Zone { id: string; reference_price_cents: number; duration_minutes: number }
export function ComboPricingFields({ mode: initialMode, fixedPrice, discount, tierItems, tierDiscount, zones, fixedOnly = false }: {
  mode: ComboPricingMode; fixedPrice: number; discount: number; tierItems: number; tierDiscount: number; zones: Zone[]; fixedOnly?: boolean;
}) {
  const [mode, setMode] = useState<ComboPricingMode>(fixedOnly ? "fixed_price" : initialMode);
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
      const manualDuration = Number(data.get("appointmentDurationMinutes"));
      const duration = Number.isSafeInteger(manualDuration) && manualDuration >= 5
        ? manualDuration
        : selected.reduce((sum, zone) => sum + zone.duration_minutes, 0);
      if (!selected.length || !Number.isFinite(sessions) || sessions < 1) { setEstimate(null); return; }
      const combo: TreatmentCombo = {
        id: "preview", treatmentId: "preview", name: "", description: "", audience: "shared", mode: sessions > 1 ? "package" : "single_session",
        sessionCount: sessions, pricingMode: mode, fixedPriceCents: fixed, appointmentDurationMinutes: null, discountPercent: Number(data.get("discountPercent")),
        tierMinItems: Number(data.get("tierMinItems")), tierDiscountPercent: Number(data.get("tierDiscountPercent")),
        referencePriceCents: selected.reduce((sum, zone) => sum + zone.reference_price_cents, 0) * sessions,
        durationMinutes: duration,
        zones: selected.map((zone) => ({ id: zone.id, name: "", audience: "shared", referencePriceCents: zone.reference_price_cents, durationMinutes: zone.duration_minutes, displayOrder: 0, isActive: true })),
        extras: [], allowPublicExtras: false, validityDays: null, displayOrder: 0, isActive: false, pricePerSessionCents: 0, savingsCents: 0,
      };
      if (fixedOnly) {
        if (!Number.isSafeInteger(fixed) || fixed <= 0) { setEstimate(null); return; }
        const total = calculateOrderTotal({
          combo: { id: combo.id, name: combo.name, priceCents: fixed, durationMinutes: combo.durationMinutes, includedZoneIds: selected.map(z => z.id), sessionCount: sessions },
          zones: [], discountPercent: 0,
        });
        setEstimate({ ...quoteCombo({ ...combo, pricingMode: "fixed_price" }), priceCents: total.totalCents, durationMinutes: total.durationMinutes });
      } else setEstimate(quoteCombo(combo));
    };
    queueMicrotask(calculate);
    form.addEventListener("input", calculate);
    form.addEventListener("change", calculate);
    return () => { form.removeEventListener("input", calculate); form.removeEventListener("change", calculate); };
  }, [mode, zones, fixedOnly]);
  return <div ref={root}>
    <div className="admin-form-grid">
      {fixedOnly ? <input type="hidden" name="pricingMode" value="fixed_price" /> : <label>Regla de precio<select name="pricingMode" value={mode} onChange={(event) => setMode(event.target.value as ComboPricingMode)}><option value="fixed_price">Precio final manual</option><option value="percentage_discount">Descuento porcentual</option><option value="tiered_discount">Descuento por cantidad</option></select></label>}
      <label hidden={mode !== "fixed_price"}>Precio total del combo<input name="fixedPricePesos" type="number" min="1" step="1" defaultValue={fixedPrice || ""} required={mode === "fixed_price"} disabled={mode !== "fixed_price"} /></label>
      <label hidden={mode !== "percentage_discount"}>Descuento %<input name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={discount} required={mode === "percentage_discount"} disabled={mode !== "percentage_discount"} /></label>
      <label hidden={mode !== "tiered_discount"}>Cantidad mínima de zonas y extras<input name="tierMinItems" type="number" min="1" max="99" defaultValue={tierItems} required={mode === "tiered_discount"} disabled={mode !== "tiered_discount"} /></label>
      <label hidden={mode !== "tiered_discount"}>Descuento por cantidad %<input name="tierDiscountPercent" type="number" min="0" max="100" step="0.01" defaultValue={tierDiscount} required={mode === "tiered_discount"} disabled={mode !== "tiered_discount"} /></label>
    </div>
    <p className="admin-field-note numeric" aria-live="polite">{estimate ? <>Base sin extras: {formatPrice(estimate.priceCents)} · {formatPrice(estimate.pricePerSessionCents)} por sesión · {formatDuration(estimate.durationMinutes)} por turno, sin preparación. {fixedOnly ? "El combo conserva este precio. Solo las zonas adicionales pueden recibir el descuento global." : "Los extras elegidos por el público pueden cambiar el precio y activar el descuento por cantidad."}</> : "Seleccioná zonas y un precio para previsualizar el valor del combo."}</p>
  </div>;
}
