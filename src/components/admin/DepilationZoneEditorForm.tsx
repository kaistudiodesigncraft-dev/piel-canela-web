"use client";

import { useRef, useState, type ReactNode } from "react";
import { saveDepilationZoneResult, type DepilationZoneEditorResult } from "@/app/admin/catalogo/[id]/combos/actions";
import { useUnsavedChangesGuard } from "@/lib/admin/use-unsaved-changes-guard";

const fieldNames: Record<string, string> = {
  name: "Nombre",
  audience: "Etiqueta",
  referencePricePesos: "Valor individual",
  durationMinutes: "Duración",
  displayOrder: "Orden",
  isActive: "Disponibilidad",
};

export function DepilationZoneEditorForm({ children, submitLabel, expectedUpdatedAt }: { children: ReactNode; submitLabel: string; expectedUpdatedAt?: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DepilationZoneEditorResult | null>(null);
  const savedId = useRef<string | undefined>(undefined);
  const inFlight = useRef(false);
  const [dirty, setDirty] = useState(false);
  const savedVersion = useRef(expectedUpdatedAt);
  const feedback = useRef<HTMLDivElement>(null);

  useUnsavedChangesGuard(dirty, "Hay cambios sin guardar en esta zona. ¿Querés salir y descartarlos?", () => setDirty(false));

  return <form className="admin-form depilation-zone-form" aria-busy={pending} onInput={() => { setDirty(true); }} onSubmit={async (event) => {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (savedId.current) data.set("zoneId", savedId.current);
    if (savedVersion.current) data.set("expectedUpdatedAt", savedVersion.current);
    inFlight.current = true;
    setPending(true);
    try {
      const response = await saveDepilationZoneResult(data);
      setResult(response);
      if (response.status === "saved") {
        savedId.current = response.zoneId;
        savedVersion.current = response.updatedAt;
        setDirty(false);
      }
    } catch {
      setResult({
        status: "failed",
        fieldErrors: {},
        message: "No pudimos confirmar el guardado. Tus datos siguen aquí. Antes de repetir, comprobá en el listado si se guardó para evitar duplicados.",
      });
    } finally {
      inFlight.current = false;
      setPending(false);
      requestAnimationFrame(() => feedback.current?.focus());
    }
  }}>
    <div ref={feedback} tabIndex={-1}>{result ? <div role={result.status === "saved" ? "status" : "alert"} className={`form-message${result.status === "saved" ? "" : " form-message--error"}`}>
      <p>{result.message}</p>
      {Object.entries(result.fieldErrors).map(([field, errors]) => <p key={field}><strong>{fieldNames[field] ?? "Campo"}:</strong> {errors.join(" ") || "Revisá este dato."}</p>)}
    </div> : null}</div>
    <fieldset disabled={pending} className="combo-editor-fields">
      {children}
      {dirty ? <p className="admin-unsaved-note" role="status">Tenés cambios sin guardar en esta zona.</p> : null}
      <div className="admin-form-footer"><p>Una zona guardada queda disponible para armar combos. Si ya está usada por un combo publicado, algunos cambios pueden requerir pausar primero ese combo.</p><button className="button button--primary" type="submit">{pending ? "Guardando..." : submitLabel}</button></div>
    </fieldset>
  </form>;
}
