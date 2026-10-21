"use client";

import { useState, useTransition } from "react";
import { saveDepilationDiscount } from "@/app/admin/catalogo/[id]/combos/discount-action";
import { DISCOUNT_MIN_ZONES } from "@/lib/depilation-order";

export function DepilationDiscountForm({ initialPercent }: { initialPercent: number }) {
  const [percent, setPercent] = useState(String(initialPercent));
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string }>();
  return <section className="live-admin__section">
    <h2>Descuento por zonas sueltas</h2>
    <p>Un único porcentaje para todo el sitio. Se aplica desde {DISCOUNT_MIN_ZONES} zonas sueltas o adicionales. El precio de cada combo no cambia y sus zonas incluidas no cuentan para este mínimo.</p>
    <form className="admin-form" onSubmit={event => {
      event.preventDefault();
      if (pending) return;
      startTransition(async () => {
        try { setResult(await saveDepilationDiscount({ percent: Number(percent) })); }
        catch { setResult({ ok: false, message: "No se pudo confirmar el guardado. Tu valor se conserva; reintentá." }); }
      });
    }}>
      <label>Descuento global (%)<input type="number" min="0" max="100" step="0.01" required value={percent}
        onChange={event => setPercent(event.target.value)} aria-describedby="discount-help" /></label>
      <p id="discount-help">Con 0 % no se aplica descuento. Los precios y tiempos individuales se editan en Zonas.</p>
      <button className="button button--primary" disabled={pending}>{pending ? "Guardando…" : "Guardar descuento"}</button>
      {result ? <p role={result.ok ? "status" : "alert"} className={`form-message${result.ok ? "" : " form-message--error"}`}>{result.message}</p> : null}
    </form>
  </section>;
}
