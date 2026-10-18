"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { removeCatalogEntry } from "@/app/admin/removal-actions";
import type { CatalogRemovalResult, SpecialReassignmentTarget, SpecialVersion } from "@/lib/admin/catalog-removal";

const initialState: CatalogRemovalResult = { status: "idle", message: "" };

interface Props {
  entity: "treatment" | "special";
  id: string;
  name: string;
  updatedAt?: string;
  usageAvailable?: boolean;
  hasHistory?: boolean;
  specialVersions?: SpecialVersion[];
  replacementTargets?: SpecialReassignmentTarget[];
}

export function CatalogRemovalDialog({ entity, id, name, updatedAt, usageAvailable = true, hasHistory = false, specialVersions = [], replacementTargets = [] }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const headingId = useId();
  const [disposition, setDisposition] = useState(hasHistory ? "archive" : "delete");
  const [result, action, pending] = useActionState(removeCatalogEntry, initialState);
  const treatment = entity === "treatment";
  useEffect(() => { if (result.status !== "idle") feedback.current?.focus(); }, [result]);
  return <>
    <button ref={trigger} className="button button--quiet" type="button" onClick={() => dialog.current?.showModal()}>
      {treatment ? "Eliminar o archivar tratamiento" : "Eliminar especial"}
    </button>
    <dialog ref={dialog} className="catalog-removal-dialog" aria-labelledby={headingId}
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClose={() => trigger.current?.focus()}>
      <h2 id={headingId}>{treatment ? "Eliminar o archivar" : "Eliminar especial"}</h2>
      <p><strong>{name}</strong></p>
      {result.status !== "idle" ? <p ref={feedback} tabIndex={-1} role={result.status === "done" ? "status" : "alert"} className={`form-message${result.status === "error" ? " form-message--error" : ""}`}>{result.message}{result.incidentId ? <small>Código de soporte: {result.incidentId}</small> : null}</p> : null}
      {result.status === "done" ? <div className="button-row"><Link className="button button--primary" href={treatment ? "/admin/catalogo" : "/admin?module=specials"}>Volver al listado</Link><button className="button button--quiet" type="button" onClick={() => dialog.current?.close()}>Cerrar</button></div>
        : !usageAvailable || !updatedAt ? <><p>No podemos verificar el estado actual. Cerrá este cuadro y recargá antes de continuar.</p><button className="button button--quiet" type="button" onClick={() => dialog.current?.close()}>Cerrar</button></>
          : <form action={action} className="admin-form">
            <input type="hidden" name="entity" value={entity} /><input type="hidden" name="id" value={id} />
            <input type="hidden" name="updatedAt" value={updatedAt} />
            <input type="hidden" name="versions" value={JSON.stringify(specialVersions)} />
            <fieldset disabled={pending} className="combo-editor-fields">
              {treatment ? <>
                <fieldset className="combo-editor-fields"><legend>¿Qué querés hacer?</legend>
                  {hasHistory ? <p>Hay reservas, paquetes o combos vinculados. Podés archivar el tratamiento y sus especiales; se conserva todo el historial.</p> : <>
                    <label className="admin-check"><input type="radio" name="disposition" value="delete" checked={disposition === "delete"} onChange={() => setDisposition("delete")} /><span>{specialVersions.length ? "Eliminar tratamiento y sus especiales" : "Eliminar tratamiento definitivamente"}</span></label>
                    {specialVersions.length > 0 ? <label className="admin-check"><input type="radio" name="disposition" value="reassign" checked={disposition === "reassign"} onChange={() => setDisposition("reassign")} disabled={replacementTargets.length === 0} /><span>Desvincular y conservar los especiales</span></label> : null}
                    {specialVersions.length > 0 && replacementTargets.length === 0 ? <p>No hay otro tratamiento compatible para conservar los especiales. Podés archivar sin perderlos.</p> : null}
                  </>}
                  <label className="admin-check"><input type="radio" name="disposition" value="archive" checked={disposition === "archive"} onChange={() => setDisposition("archive")} /><span>Archivar tratamiento y sus especiales</span></label>
                </fieldset>
                {disposition === "reassign" ? <><label>Tratamiento que conservará los especiales<select name="replacementId" required defaultValue=""><option value="">Seleccionar otro tratamiento</option>{replacementTargets.map(target => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label><p>Los especiales se conservarán pausados. Revisá su precio, descripción y fechas antes de volver a publicarlos en el nuevo tratamiento.</p></> : null}
                <p>{disposition === "archive" ? "Se ocultarán de la web. No se eliminan turnos, precios históricos, fotos ni combos." : "La eliminación definitiva no se puede deshacer desde este cuadro. Si aparece historial nuevo, el sistema bloqueará la operación."}</p>
              </> : <><input type="hidden" name="disposition" value="delete" /><p>Si este especial tiene reservas, se archivará y conservará su historial. Si no tiene reservas, se eliminará definitivamente. El tratamiento y su imagen se conservarán.</p></>}
              <label>Código de seguridad<input name="confirmationCode" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={128} autoComplete="off" required /></label>
              <label className="admin-check"><input type="checkbox" name="confirm" required /><span>Leí el alcance y confirmo esta acción sobre “{name}”.</span></label>
              <div className="button-row"><button className="button button--quiet" type="button" onClick={() => dialog.current?.close()}>Cancelar</button><button className="button button--danger" type="submit">{pending ? "Procesando…" : "Confirmar acción"}</button></div>
            </fieldset>
          </form>}
    </dialog>
  </>;
}
