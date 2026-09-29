"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { saveTreatmentComboResult, type ComboEditorResult } from "@/app/admin/catalogo/[id]/combos/actions";

const fieldNames: Record<string, string> = {
  name: "Nombre", zoneIds: "Zonas incluidas", extraIds: "Extras compatibles", fixedPricePesos: "Precio",
  sessionCount: "Cantidad de sesiones", validityDays: "Vigencia", discountPercent: "Descuento", tierMinItems: "Cantidad mínima", tierDiscountPercent: "Descuento por cantidad",
};

export function ComboEditorForm({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ComboEditorResult | null>(null);
  const savedId = useRef<string | undefined>(undefined);
  const inFlight = useRef(false);
  const dirty = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return <form className="admin-form depilation-combo-form" aria-busy={pending} onInput={() => { dirty.current = true; }} onSubmit={async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (savedId.current) data.set("comboId", savedId.current);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    data.set("isActive", submitter instanceof HTMLButtonElement && submitter.value === "publish" ? "on" : "off");
    inFlight.current = true;
    setPending(true);
    try {
      const response = await saveTreatmentComboResult(data);
      setResult(response);
      if (response.status === "saved") { savedId.current = response.comboId; dirty.current = false; }
    } catch {
      setResult({ status: "failed", fieldErrors: {}, message: "No pudimos confirmar el guardado. Tus datos siguen aquí. Antes de repetir, comprobá en el listado si se guardó para evitar duplicados." });
    } finally {
      inFlight.current = false;
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }}>
    <div ref={feedback} tabIndex={-1}>{result ? <div role={result.status === "saved" ? "status" : "alert"} className={`form-message${result.status === "saved" ? "" : " form-message--error"}`}>
      <p>{result.message}</p>
      {Object.entries(result.fieldErrors).map(([field, errors]) => <p key={field}><strong>{fieldNames[field] ?? "Configuración"}:</strong> {fieldNames[field] ? (field === "name" || field === "zoneIds" ? errors.join(" ") : "Revisá el valor y los límites indicados.") : "Revisá los valores ingresados."}</p>)}
    </div> : null}</div>
    <fieldset disabled={pending} className="combo-editor-fields">{children}
      <div className="admin-form-footer"><p>Guardar borrador retira este combo de la web si estaba publicado. Sus reservas y paquetes se conservan.</p><button className="button button--quiet" type="submit" name="intent" value="draft">{pending ? "Guardando…" : "Guardar borrador"}</button><button className="button button--primary" type="submit" name="intent" value="publish">Publicar combo</button></div>
    </fieldset>
  </form>;
}
