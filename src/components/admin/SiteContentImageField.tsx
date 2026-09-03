"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { ImageIcon, LoaderCircle, UploadCloud } from "lucide-react";
import type { SiteContentField } from "@/domain/site-content";
import {
  createSiteContentMediaUploadIntent,
  finalizeSiteContentMediaUpload,
} from "@/app/admin/contenido/actions";
import { inspectAdminImage } from "@/lib/admin/image-upload";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UploadStatus = "idle" | "preparing" | "uploading" | "processing" | "complete" | "failed";

export function SiteContentImageField({
  field,
  onPreviewChange,
}: {
  field: SiteContentField;
  onPreviewChange?: (field: SiteContentField) => void;
}) {
  const inputId = useId();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [imagePath, setImagePath] = useState(field.imagePath ?? "");
  const [previewUrl, setPreviewUrl] = useState(field.settings.enabled ? field.value : "");

  useEffect(() => () => {
    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus("preparing");
    setMessage("Validando imagen…");
    const inspection = await inspectAdminImage(file);
    if (!inspection.valid) {
      setStatus("failed");
      setMessage("Usá JPG, PNG, WebP o AVIF de al menos 640 × 640 px y hasta 4 MB.");
      return;
    }

    const prepared = await createSiteContentMediaUploadIntent({
      key: field.key,
      section: field.section,
      mimeType: file.type,
      size: file.size,
    });
    if (!prepared.ok) {
      setStatus("failed");
      setMessage(prepared.error);
      return;
    }

    setStatus("uploading");
    setMessage("Subiendo imagen…");
    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from("site-content-media-ingest")
      .uploadToSignedUrl(prepared.intent.path, prepared.intent.token, file, { contentType: file.type });
    if (uploadError) {
      setStatus("failed");
      setMessage("La carga se interrumpió. Volvé a elegir la imagen.");
      return;
    }

    setStatus("processing");
    setMessage("Verificando imagen…");
    const finalized = await finalizeSiteContentMediaUpload({
      key: field.key,
      section: field.section,
      ingestPath: prepared.intent.path,
      mimeType: file.type,
    });
    if (!finalized.ok) {
      setStatus("failed");
      setMessage(finalized.error);
      return;
    }

    if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setImagePath(finalized.imagePath);
    setPreviewUrl(finalized.publicUrl);
    onPreviewChange?.({
      ...field,
      value: finalized.publicUrl,
      imagePath: finalized.imagePath,
    });
    setStatus("complete");
    setMessage("Imagen lista. Guardá el borrador o publicá para conservar el cambio.");
  }

  const decorative = field.settings.presentation === "background";
  const busy = ["preparing", "uploading", "processing"].includes(status);

  return (
    <fieldset className="content-image-field">
      <legend>{field.label}</legend>
      <div className="content-image-field__preview">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt={decorative ? "" : field.imageAlt ?? "Vista previa"}
            fill
            unoptimized={previewUrl.startsWith("blob:") || undefined}
            sizes="(max-width: 720px) 90vw, 360px"
            style={{ objectPosition: `${field.settings.focalX}% ${field.settings.focalY}%` }}
          />
        ) : (
          <span className="content-image-field__empty">
            <ImageIcon aria-hidden="true" strokeWidth={1.75} />
            Sin imagen asignada
          </span>
        )}
      </div>

      <div className="content-image-field__controls">
        <input type="hidden" name={`${field.key}_image_path`} value={imagePath} />
        <label className="content-field" htmlFor={inputId}>
          <span>Reemplazar imagen</span>
          <span className="content-file-control">
            {busy ? <LoaderCircle className="content-upload-spinner" aria-hidden="true" /> : <UploadCloud aria-hidden="true" strokeWidth={1.75} />}
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={busy}
              onChange={(event) => void handleFile(event.currentTarget.files?.[0])}
            />
          </span>
          <small>JPG, PNG, WebP o AVIF. Mínimo 640 × 640 px. Máximo 4 MB.</small>
        </label>

        <label className="content-field">
          <span>{decorative ? "Descripción interna opcional" : "Descripción accesible"}</span>
          <input
            type="text"
            name={`${field.key}_alt`}
            defaultValue={field.imageAlt ?? ""}
            minLength={decorative ? undefined : 3}
            maxLength={240}
            required={!decorative}
          />
          {decorative ? <small>El fondo se oculta a lectores de pantalla porque no comunica contenido.</small> : null}
        </label>

        <div className="content-image-settings">
          <label>
            Punto focal horizontal
            <input
              type="range"
              name={`${field.key}_focal_x`}
              min="0"
              max="100"
              defaultValue={field.settings.focalX}
              onChange={(event) => onPreviewChange?.({ ...field, value: previewUrl, imagePath, settings: { ...field.settings, focalX: Number(event.target.value) } })}
            />
          </label>
          <label>
            Punto focal vertical
            <input
              type="range"
              name={`${field.key}_focal_y`}
              min="0"
              max="100"
              defaultValue={field.settings.focalY}
              onChange={(event) => onPreviewChange?.({ ...field, value: previewUrl, imagePath, settings: { ...field.settings, focalY: Number(event.target.value) } })}
            />
          </label>
          <label>
            Superficie
            <select name={`${field.key}_surface`} defaultValue={field.settings.surfacePreset} onChange={(event) => onPreviewChange?.({ ...field, value: previewUrl, imagePath, settings: { ...field.settings, surfacePreset: event.target.value as SiteContentField["settings"]["surfacePreset"] } })}>
              <option value="plain">Clara</option>
              <option value="soft">Suave</option>
              <option value="contrast">Contraste</option>
            </select>
          </label>
          <label>
            Protección de texto
            <select name={`${field.key}_overlay`} defaultValue={field.settings.overlayPreset} onChange={(event) => onPreviewChange?.({ ...field, value: previewUrl, imagePath, settings: { ...field.settings, overlayPreset: event.target.value as SiteContentField["settings"]["overlayPreset"] } })}>
              <option value="none">Sin capa</option>
              <option value="light">Ligera</option>
              <option value="medium">Media</option>
              <option value="strong">Alta</option>
            </select>
          </label>
        </div>

        {message ? (
          <p className={`content-upload-status content-upload-status--${status}`} role={status === "failed" ? "alert" : "status"}>
            {message}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
