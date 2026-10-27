"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, History, RotateCcw, Save, Send } from "lucide-react";
import type { SiteContentField, SiteContentSection } from "@/domain/site-content";
import { getSiteContentCharacterLimit } from "@/domain/site-content";
import type { SiteContentRevisionSummary } from "@/lib/supabase/site-content";
import {
  restoreSiteContentRevision,
  submitSiteContentSection,
  type SiteContentEditorState,
} from "@/app/admin/contenido/actions";
import { SiteContentImageField } from "./SiteContentImageField";
import { useUnsavedChangesGuard } from "@/lib/admin/use-unsaved-changes-guard";

const initialState: SiteContentEditorState = { status: "idle", fieldErrors: {} };

function comparableFields(fields: readonly SiteContentField[]) {
  return fields.map(({ key, value, imagePath, imageAlt, settings }) => ({
    key,
    value,
    imagePath,
    imageAlt,
    settings,
  }));
}

export function ContentSectionEditor({
  section,
  title,
  description,
  fields,
  publishedFields,
  revisions,
}: {
  section: SiteContentSection;
  title: string;
  description: string;
  fields: readonly SiteContentField[];
  publishedFields: readonly SiteContentField[];
  revisions: readonly SiteContentRevisionSummary[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(submitSiteContentSection, initialState);
  const [previewWidth, setPreviewWidth] = useState<390 | 1440>(390);
  const [previewFields, setPreviewFields] = useState<readonly SiteContentField[]>(fields);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const [previewHeight, setPreviewHeight] = useState(560);
  const [isDirty, setIsDirty] = useState(false);
  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(comparableFields(fields)) !== JSON.stringify(comparableFields(publishedFields)),
    [fields, publishedFields],
  );

  useEffect(() => {
    if (state.status === "saved" || state.status === "published") {
      // Resetting the dirty flag here mirrors the server action result (an external
      // system) so the unsaved-changes guard clears once the save is confirmed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDirty(false);
      router.refresh();
    }
  }, [router, state.status]);

  useUnsavedChangesGuard(isDirty, "Hay cambios sin guardar en esta sección. ¿Querés salir y descartarlos?", () => setIsDirty(false));

  const sendPreview = useCallback(() => {
    previewFrame.current?.contentWindow?.postMessage({ type: "piel-canela-content-preview", section, fields: previewFields }, window.location.origin);
  }, [previewFields, section]);

  useEffect(() => {
    const receive = (event: MessageEvent<{ type?: string; height?: number }>) => {
      if (event.origin !== window.location.origin || event.source !== previewFrame.current?.contentWindow) return;
      if (event.data.type === "piel-canela-content-preview-ready") sendPreview();
      if (event.data.type === "piel-canela-content-preview-height" && typeof event.data.height === "number") setPreviewHeight(Math.min(Math.max(event.data.height, 320), 1200));
    };
    window.addEventListener("message", receive);
    sendPreview();
    return () => window.removeEventListener("message", receive);
  }, [sendPreview, previewWidth]);

  function updatePreviewField(nextField: SiteContentField) {
    setIsDirty(true);
    setPreviewFields((current) => current.map((field) => field.key === nextField.key ? nextField : field));
  }

  function handlePreviewInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const key = target.name;
    const value = target.value;
    setIsDirty(true);
    setPreviewFields((current) => current.map((field) => field.key === key && field.kind !== "image" ? { ...field, value } : field));
  }

  return (
    <section className="content-editor-section" id={section} aria-labelledby={`${section}-title`}>
      <div className="content-editor-section__heading">
        <div>
          <h2 id={`${section}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className={`content-save-status${hasUnpublishedChanges ? " content-save-status--draft" : ""}`}>
          {hasUnpublishedChanges ? "Cambios sin publicar" : "Publicado"}
        </span>
      </div>

      <div className="content-editor-layout">
        <form action={action} className="content-editor-form" onInput={handlePreviewInput}>
          <input type="hidden" name="section" value={section} />
          {fields.map((field) => field.kind === "image" ? (
            <SiteContentImageField field={previewFields.find((item) => item.key === field.key) ?? field} key={field.key} onPreviewChange={updatePreviewField} />
          ) : (
            <label className="content-field" key={field.key}>
              <span>{field.label}</span>
              {field.kind === "long_text" ? (
                <textarea
                  name={field.key}
                  defaultValue={field.value}
                  rows={4}
                  maxLength={getSiteContentCharacterLimit(field)}
                  required
                  aria-invalid={Boolean(state.fieldErrors[field.key])}
                  aria-describedby={state.fieldErrors[field.key] ? `${field.key}-error` : undefined}
                />
              ) : (
                <input
                  type="text"
                  name={field.key}
                  defaultValue={field.value}
                  maxLength={getSiteContentCharacterLimit(field)}
                  required
                  aria-invalid={Boolean(state.fieldErrors[field.key])}
                  aria-describedby={state.fieldErrors[field.key] ? `${field.key}-error` : undefined}
                />
              )}
              <small>Máximo {getSiteContentCharacterLimit(field)} caracteres.</small>
              {state.fieldErrors[field.key] ? (
                <small id={`${field.key}-error`} className="content-field__error">{state.fieldErrors[field.key]?.join(" ")}</small>
              ) : null}
            </label>
          ))}

          {state.message ? (
            <p className={`form-message${state.status === "failed" || state.status === "invalid" ? " form-message--error" : ""}`} role={state.status === "failed" || state.status === "invalid" ? "alert" : "status"}>
              {state.message}{state.incidentId ? ` Código de soporte: ${state.incidentId}.` : ""}
            </p>
          ) : null}
          {isDirty ? <p className="admin-unsaved-note" role="status">Tenés cambios sin guardar en esta sección.</p> : null}

          <div className="content-editor-form__footer">
            <p>El borrador no modifica la web hasta que elijas publicar.</p>
            <div className="button-row">
              <button className="button button--quiet" type="submit" name="intent" value="draft" disabled={pending}>
                <Save aria-hidden="true" strokeWidth={1.75} />
                {pending ? "Guardando…" : "Guardar borrador"}
              </button>
              <button className="button button--primary" type="submit" name="intent" value="publish" disabled={pending}>
                <Send aria-hidden="true" strokeWidth={1.75} />
                {pending ? "Procesando…" : "Publicar sección"}
              </button>
            </div>
          </div>
        </form>

        <aside className="content-preview-panel" aria-label={`Vista previa de ${title}`}>
          <div className="content-preview-panel__heading">
            <span><Eye aria-hidden="true" strokeWidth={1.75} /> Vista previa de esta edición</span>
            <div className="content-preview-toggle" aria-label="Tamaño de vista previa">
              <button type="button" aria-pressed={previewWidth === 390} onClick={() => setPreviewWidth(390)}>390 px</button>
              <button type="button" aria-pressed={previewWidth === 1440} onClick={() => setPreviewWidth(1440)}>1440 px</button>
            </div>
          </div>
          <div className="content-preview-viewport" tabIndex={0} role="region" aria-label={`Área desplazable de vista previa de ${title}`}>
            <iframe
              ref={previewFrame}
              className={`content-preview-frame content-preview-frame--${previewWidth === 390 ? "mobile" : "desktop"}`}
              style={{ width: previewWidth, height: previewHeight }}
              src={`/admin/contenido/preview?section=${section}`}
              title={`Vista previa real de ${title} a ${previewWidth} píxeles`}
              onLoad={sendPreview}
            />
          </div>

          <details className="content-revisions">
            <summary><History aria-hidden="true" strokeWidth={1.75} /> Historial publicado</summary>
            {revisions.length === 0 ? <p>Todavía no hay versiones anteriores.</p> : (
              <ul>
                {revisions.slice(0, 5).map((revision) => (
                  <li key={revision.id}>
                    <span>{new Intl.DateTimeFormat("es-AR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "America/Argentina/Cordoba",
                    }).format(new Date(revision.createdAt))}</span>
                    <form action={restoreSiteContentRevision}>
                      <input type="hidden" name="revisionId" value={revision.id} />
                      <button className="text-link" type="submit">
                        <RotateCcw aria-hidden="true" strokeWidth={1.75} /> Restaurar
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </details>
        </aside>
      </div>
    </section>
  );
}
