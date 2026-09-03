"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, History, RotateCcw, Save, Send } from "lucide-react";
import type { SiteContentField, SiteContentSection } from "@/domain/site-content";
import type { SiteContentRevisionSummary } from "@/lib/supabase/site-content";
import {
  restoreSiteContentRevision,
  submitSiteContentSection,
  type SiteContentEditorState,
} from "@/app/admin/contenido/actions";
import { SiteContentImageField } from "./SiteContentImageField";

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

function Preview({ fields, width }: { fields: readonly SiteContentField[]; width: 390 | 1440 }) {
  const text = fields.filter((field) => field.kind !== "image");
  const image = fields.find((field) => field.kind === "image" && field.settings.enabled && field.value);
  const title = text.find((field) => field.key.endsWith("_title")) ?? text[0];
  const eyebrow = text.find((field) => field.key.endsWith("_eyebrow"));
  const copy = text.filter((field) => field !== title && field !== eyebrow).slice(0, width === 390 ? 2 : 4);

  return (
    <div className={`content-preview content-preview--${width === 390 ? "mobile" : "desktop"}`} style={{ maxWidth: width }}>
      {image ? (
        <div
          className={`content-preview__background content-preview__background--${image.settings.overlayPreset}`}
          aria-hidden="true"
          style={{
            backgroundImage: `url("${image.value.replaceAll('"', "%22")}")`,
            backgroundPosition: `${image.settings.focalX}% ${image.settings.focalY}%`,
          }}
        />
      ) : null}
      <div className="content-preview__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow.value}</p> : null}
        {title ? <h3>{title.value}</h3> : null}
        {copy.map((field) => <p key={field.key}>{field.value}</p>)}
      </div>
    </div>
  );
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
  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(comparableFields(fields)) !== JSON.stringify(comparableFields(publishedFields)),
    [fields, publishedFields],
  );

  useEffect(() => {
    if (state.status === "saved" || state.status === "published") router.refresh();
  }, [router, state.status]);

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
        <form action={action} className="content-editor-form">
          <input type="hidden" name="section" value={section} />
          {fields.map((field) => field.kind === "image" ? (
            <SiteContentImageField field={field} key={field.key} />
          ) : (
            <label className="content-field" key={field.key}>
              <span>{field.label}</span>
              {field.kind === "long_text" ? (
                <textarea
                  name={field.key}
                  defaultValue={field.value}
                  rows={4}
                  maxLength={1400}
                  required
                  aria-invalid={Boolean(state.fieldErrors[field.key])}
                  aria-describedby={state.fieldErrors[field.key] ? `${field.key}-error` : undefined}
                />
              ) : (
                <input
                  type="text"
                  name={field.key}
                  defaultValue={field.value}
                  maxLength={180}
                  required
                  aria-invalid={Boolean(state.fieldErrors[field.key])}
                  aria-describedby={state.fieldErrors[field.key] ? `${field.key}-error` : undefined}
                />
              )}
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
            <span><Eye aria-hidden="true" strokeWidth={1.75} /> Vista previa del borrador guardado</span>
            <div className="content-preview-toggle" aria-label="Tamaño de vista previa">
              <button type="button" aria-pressed={previewWidth === 390} onClick={() => setPreviewWidth(390)}>390 px</button>
              <button type="button" aria-pressed={previewWidth === 1440} onClick={() => setPreviewWidth(1440)}>1440 px</button>
            </div>
          </div>
          <div className="content-preview-viewport">
            <Preview fields={fields} width={previewWidth} />
          </div>

          <details className="content-revisions">
            <summary><History aria-hidden="true" strokeWidth={1.75} /> Historial publicado</summary>
            {revisions.length === 0 ? <p>Todavía no hay versiones anteriores.</p> : (
              <ul>
                {revisions.slice(0, 5).map((revision) => (
                  <li key={revision.id}>
                    <span>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.createdAt))}</span>
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
