"use client";

import { AlertCircle, Check, Eye, ImageIcon, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteTreatment,
  initialSaveTreatmentState,
  saveTreatment,
  type SaveTreatmentState,
} from "@/app/admin/catalogo/actions";
import {
  createTreatmentMediaUploadIntent,
  finalizeTreatmentMediaUpload,
} from "@/app/admin/catalogo/media-actions";
import { focalPointToPercentage, linesToAdminText } from "@/lib/admin/catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  normalizeTreatmentImage,
  TREATMENT_MEDIA_INGEST_BUCKET,
  type TreatmentMediaStage,
} from "@/lib/admin/treatment-media";
import type {
  AdminCategoryRow,
  AdminProfessionalRow,
  AdminSpecialtyRow,
  AdminTreatmentRow,
} from "@/lib/admin/treatment-editor-types";

interface TreatmentEditorProps {
  treatmentId: string;
  isNew: boolean;
  categories: AdminCategoryRow[];
  specialties: AdminSpecialtyRow[];
  professionals: AdminProfessionalRow[];
  treatment?: AdminTreatmentRow;
}

const treatmentErrorMessages: Record<string, string> = {
  impact: "El cambio puede afectar reservas futuras.",
  publishable: "Faltan datos necesarios para publicar.",
  professional: "La asignación profesional no es válida.",
  duplicate: "La URL del tratamiento ya está en uso.",
  lists: "Revisá las listas de información pública.",
  image: "La carga de imagen no pudo verificarse.",
  taxonomy: "La categoría o especialidad ya no está disponible.",
  missing: "El tratamiento ya no existe o no está disponible.",
  invalid: "Hay datos que necesitan corrección.",
  save: "No pudimos guardar el tratamiento.",
  unexpected: "Se interrumpió el guardado. Volvé a intentar.",
};

const mediaStageLabels: Record<TreatmentMediaStage, string> = {
  idle: "Elegí una imagen para comenzar.",
  preparing: "Preparando y quitando metadatos…",
  uploading: "Subiendo directamente al espacio seguro…",
  processing: "Verificando el archivo…",
  completed: "Imagen lista para guardar.",
  failed: "La imagen no se pudo preparar.",
};

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return <span className="admin-field-error" id={id} role="alert">{messages[0]}</span>;
}

function TreatmentActionFeedback({ state, formId }: { state: SaveTreatmentState; formId: string }) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status !== "idle") feedbackRef.current?.focus();
  }, [state]);
  if (state.status === "idle") return null;
  const fields = Object.entries(state.fieldErrors ?? {});
  const knownTitle = treatmentErrorMessages[state.error ?? ""];
  const unknownCode = !knownTitle && state.error ? state.error : null;
  return (
    <div className="form-message form-message--error admin-form-error-summary" role="alert" tabIndex={-1} ref={feedbackRef}>
      <strong>{knownTitle ?? "No pudimos guardar los cambios."}</strong>
      {fields.length > 0 ? (
        <ul>{fields.map(([field, messages]) => <li key={field}><a href={`#${formId}-${field}`}>{messages[0]}</a></li>)}</ul>
      ) : <p>Volvé a intentar. Tus datos siguen en el formulario.</p>}
      {unknownCode ? <small>Detalle técnico: {unknownCode}</small> : null}
      {state.incidentId ? <small>Código de soporte: {state.incidentId}</small> : null}
    </div>
  );
}

function EditorSubmitButtons({ isNew, isPublished, mediaBusy }: { isNew: boolean; isPublished: boolean; mediaBusy: boolean }) {
  const { pending } = useFormStatus();
  const disabled = pending || mediaBusy;
  return (
    <div className="admin-treatment-editor-actions">
      <button className="button button--quiet" type="submit" name="submitIntent" value="draft" disabled={disabled}>
        {pending ? "Guardando…" : isPublished ? "Desactivar y guardar" : isNew ? "Guardar borrador" : "Guardar borrador"}
      </button>
      <button className="button button--primary" type="submit" name="submitIntent" value="publish" disabled={disabled}>
        {pending ? "Publicando…" : isPublished ? "Guardar publicado" : "Publicar tratamiento"}
      </button>
    </div>
  );
}

function DeleteTreatmentButton() {
  const { pending } = useFormStatus();
  return <button className="button button--danger" type="submit" disabled={pending}><Trash2 aria-hidden="true" strokeWidth={1.75} />{pending ? "Eliminando…" : "Eliminar definitivamente"}</button>;
}

function DeleteTreatmentForm({ treatment }: { treatment: AdminTreatmentRow }) {
  return (
    <details className="admin-delete-treatment">
      <summary><span><Trash2 aria-hidden="true" strokeWidth={1.75} />Eliminar tratamiento</span></summary>
      <form action={deleteTreatment} className="admin-delete-treatment__form">
        <input type="hidden" name="treatmentId" value={treatment.id} />
        <div><strong>Esta acción no se puede deshacer.</strong><p>Solo se eliminará si no tiene reservas ni especiales asociados. Si tiene historial, desactivalo.</p></div>
        <label htmlFor={`delete-code-${treatment.id}`}>Código de eliminación<input id={`delete-code-${treatment.id}`} name="confirmationCode" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={128} autoComplete="off" required /></label>
        <label className="admin-check" htmlFor={`delete-confirm-${treatment.id}`}><input id={`delete-confirm-${treatment.id}`} name="confirmDeletion" type="checkbox" required /><span>Confirmo que quiero eliminar “{treatment.name}”.</span></label>
        <DeleteTreatmentButton />
      </form>
    </details>
  );
}

export function TreatmentEditor({ treatmentId, isNew, categories, specialties, professionals, treatment }: TreatmentEditorProps) {
  const formId = `treatment-${treatmentId}`;
  const [actionState, formAction] = useActionState(saveTreatment, initialSaveTreatmentState);
  const [selectedSpecialty, setSelectedSpecialty] = useState(treatment?.specialty_id ?? "");
  const [selectedProfessional, setSelectedProfessional] = useState(treatment?.professional_id ?? "");
  const [durationMinutes, setDurationMinutes] = useState(treatment?.duration_minutes ?? 60);
  const [bufferMinutes, setBufferMinutes] = useState(treatment?.buffer_minutes ?? 15);
  const [startIntervalMinutes, setStartIntervalMinutes] = useState<15 | 30 | 60>(treatment?.start_interval_minutes ?? 30);
  const [focalX, setFocalX] = useState(focalPointToPercentage(treatment?.image_focal_x ?? 0.5));
  const [focalY, setFocalY] = useState(focalPointToPercentage(treatment?.image_focal_y ?? 0.5));
  const [imagePath, setImagePath] = useState(treatment?.image_path ?? "");
  const [imagePreview, setImagePreview] = useState(treatment?.image_url ?? null);
  const [mediaStage, setMediaStage] = useState<TreatmentMediaStage>(treatment?.image_path ? "completed" : "idle");
  const [mediaIssue, setMediaIssue] = useState<string | null>(null);
  const [mediaMetadata, setMediaMetadata] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const isDirtyRef = useRef(false);
  const uploadSequence = useRef(0);
  const activeSpecialties = specialties.filter((item) => item.is_active || item.id === treatment?.specialty_id);
  const availableProfessionals = useMemo(() => professionals.filter((item) =>
    item.specialty_id === selectedSpecialty && (item.is_active || item.id === treatment?.professional_id),
  ), [professionals, selectedSpecialty, treatment?.professional_id]);
  const mediaBusy = mediaStage === "preparing" || mediaStage === "uploading" || mediaStage === "processing";
  const fieldError = (name: string) => actionState.fieldErrors?.[name];

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const protectInternalNavigation = (event: MouseEvent) => {
      if (!isDirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank") return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (!window.confirm("Hay cambios sin guardar. ¿Querés salir y descartarlos?")) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        isDirtyRef.current = false;
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", protectInternalNavigation, true);
    };
  }, []);

  async function uploadImage(file: File | undefined, input: HTMLInputElement) {
    const sequence = ++uploadSequence.current;
    input.setCustomValidity("");
    setMediaIssue(null);
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setImagePreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return localPreview;
    });
    try {
      setMediaStage("preparing");
      const normalized = await normalizeTreatmentImage(file);
      if (sequence !== uploadSequence.current) return;
      const sizeText = normalized.blob.size < 1024 * 1024
        ? `${Math.max(1, Math.round(normalized.blob.size / 1024))} KB`
        : `${(normalized.blob.size / 1024 / 1024).toFixed(1)} MB`;
      setMediaMetadata(`${normalized.width} × ${normalized.height} px · ${sizeText}`);
      const intentResult = await createTreatmentMediaUploadIntent(treatmentId);
      if (!intentResult.ok) throw new Error(`intent_${intentResult.incidentId}`);
      setMediaStage("uploading");
      const client = createSupabaseBrowserClient();
      const { error: uploadError } = await client.storage.from(TREATMENT_MEDIA_INGEST_BUCKET).uploadToSignedUrl(
        intentResult.intent.path,
        intentResult.intent.token,
        normalized.blob,
        { contentType: normalized.blob.type },
      );
      if (uploadError) {
        console.error("treatment_media_upload_failed", {
          path: intentResult.intent.path,
          blobType: normalized.blob.type,
          blobSize: normalized.blob.size,
          errorName: uploadError.name,
          errorMessage: uploadError.message,
        });
        throw new Error(`upload_failed:${uploadError.message || uploadError.name || "unknown"}`);
      }
      if (sequence !== uploadSequence.current) return;
      setMediaStage("processing");
      const finalized = await finalizeTreatmentMediaUpload(intentResult.intent.id);
      if (!finalized.ok) throw new Error(`finalize_${finalized.incidentId}`);
      if (sequence !== uploadSequence.current) return;
      setImagePath(finalized.imagePath);
      setMediaStage("completed");
      setIsDirty(true);
    } catch (error) {
      if (sequence !== uploadSequence.current) return;
      const rawCode = error instanceof Error ? error.message : "unknown";
      const code = rawCode.split(":")[0] ?? "unknown";
      const detail = rawCode.includes(":") ? rawCode.slice(code.length + 1) : "";
      console.error("treatment_media_flow_failed", { rawCode, detail, error });
      const message = code === "image_too-small"
        ? "La imagen debe tener al menos 640 × 640 píxeles."
        : code === "image_too-large"
          ? "La imagen supera los 40 megapíxeles permitidos."
          : code === "image_size"
            ? "La imagen supera el máximo de 4 MB."
            : code === "image_normalization_failed"
              ? "Tu navegador no pudo convertir la imagen a WebP. Probá con JPG."
              : code === "image_canvas_unavailable"
                ? "Tu navegador no soporta la preparación de imagen en canvas."
                : code === "upload_failed"
                  ? `La subida directa a Supabase falló${detail ? `: ${detail}` : "."} Revisá la consola del navegador (treatment_media_upload_failed) para el detalle.`
                  : code.startsWith("intent_") || code.startsWith("finalize_")
                    ? `No pudimos completar la carga. Código de soporte: ${code.split("_")[1]}`
                    : `La preparación falló (${rawCode}). Contactá a soporte con este código.`;
      input.setCustomValidity(message);
      setMediaIssue(message);
      setMediaStage("failed");
    }
  }

  return (
    <div className="admin-treatment-editor-shell">
      <form action={formAction} className="admin-form admin-form--treatment admin-treatment-editor" onInput={() => setIsDirty(true)}>
        <input type="hidden" name="treatmentId" value={treatmentId} />
        <input type="hidden" name="isNew" value={String(isNew)} />
        <input type="hidden" id={`${formId}-imagePath`} name="imagePath" value={imagePath} />
        <TreatmentActionFeedback state={actionState} formId={formId} />

        <fieldset>
          <legend>Información pública</legend>
          <div className="admin-form-grid admin-form-grid--3">
            <label htmlFor={`${formId}-name`}>Nombre<input id={`${formId}-name`} name="name" defaultValue={treatment?.name ?? ""} minLength={2} maxLength={120} required aria-invalid={Boolean(fieldError("name")) || undefined} /><FieldError id={`${formId}-name-error`} messages={fieldError("name")} /></label>
            <label htmlFor={`${formId}-categoryId`}>Categoría<select id={`${formId}-categoryId`} name="categoryId" defaultValue={treatment?.category_id ?? ""} required aria-invalid={Boolean(fieldError("categoryId")) || undefined}><option value="">Seleccionar</option>{categories.filter((item) => item.is_active || item.id === treatment?.category_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><FieldError id={`${formId}-categoryId-error`} messages={fieldError("categoryId")} /></label>
            <label htmlFor={`${formId}-displayOrder`}>Orden<input id={`${formId}-displayOrder`} name="displayOrder" type="number" min="0" max="999" defaultValue={treatment?.display_order ?? 0} required /></label>
          </div>
          <label htmlFor={`${formId}-shortDescription`}>Descripción breve<textarea id={`${formId}-shortDescription`} name="shortDescription" defaultValue={treatment?.short_description ?? ""} rows={2} minLength={10} maxLength={240} required aria-invalid={Boolean(fieldError("shortDescription")) || undefined} /><FieldError id={`${formId}-shortDescription-error`} messages={fieldError("shortDescription")} /></label>
          <label htmlFor={`${formId}-description`}>Detalle completo<textarea id={`${formId}-description`} name="description" defaultValue={treatment?.description ?? ""} rows={5} minLength={20} maxLength={3000} required aria-invalid={Boolean(fieldError("description")) || undefined} /><FieldError id={`${formId}-description-error`} messages={fieldError("description")} /></label>
          <div className="admin-form-grid">
            <label htmlFor={`${formId}-characteristics`}>Características de la ficha<small>Hasta tres, una por línea.</small><textarea id={`${formId}-characteristics`} name="characteristics" defaultValue={linesToAdminText(treatment?.characteristics ?? [])} rows={4} /><FieldError id={`${formId}-characteristics-error`} messages={fieldError("characteristics")} /></label>
            <label htmlFor={`${formId}-expectations`}>Qué puede esperar la persona<small>Una idea por línea.</small><textarea id={`${formId}-expectations`} name="expectations" defaultValue={linesToAdminText(treatment?.expectations ?? [])} rows={4} /><FieldError id={`${formId}-expectations-error`} messages={fieldError("expectations")} /></label>
          </div>
          <div className="admin-form-grid">
            <label htmlFor={`${formId}-preparation`}>Preparación opcional<textarea id={`${formId}-preparation`} name="preparation" defaultValue={treatment?.preparation ?? ""} rows={3} maxLength={1400} /></label>
            <label htmlFor={`${formId}-contraindications`}>Cuándo consultar antes<textarea id={`${formId}-contraindications`} name="contraindications" defaultValue={treatment?.contraindications ?? ""} rows={3} maxLength={1400} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Operación y precio</legend>
          <div className="admin-form-grid admin-form-grid--3">
            <label htmlFor={`${formId}-specialtyId`}>Especialidad<select id={`${formId}-specialtyId`} name="specialtyId" value={selectedSpecialty} onChange={(event) => { setSelectedSpecialty(event.target.value); setSelectedProfessional(""); }} required aria-invalid={Boolean(fieldError("specialtyId")) || undefined}><option value="">Seleccionar</option>{activeSpecialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><FieldError id={`${formId}-specialtyId-error`} messages={fieldError("specialtyId")} /></label>
            <label htmlFor={`${formId}-professionalId`}>Profesional opcional<select id={`${formId}-professionalId`} name="professionalId" value={selectedProfessional} onChange={(event) => setSelectedProfessional(event.target.value)} aria-invalid={Boolean(fieldError("professionalId")) || undefined}><option value="">Sin asignación fija</option>{availableProfessionals.map((item) => <option key={item.id} value={item.id}>{item.public_name || item.full_name}</option>)}</select><FieldError id={`${formId}-professionalId-error`} messages={fieldError("professionalId")} /></label>
            <label htmlFor={`${formId}-pricePesos`}>Precio en pesos<input id={`${formId}-pricePesos`} name="pricePesos" type="number" min="0" step="1" defaultValue={treatment ? treatment.price_cents / 100 : ""} aria-invalid={Boolean(fieldError("pricePesos")) || undefined} /><FieldError id={`${formId}-pricePesos-error`} messages={fieldError("pricePesos")} /></label>
          </div>
          <div className="admin-form-grid admin-form-grid--3">
            <label htmlFor={`${formId}-durationMinutes`}>Duración<input id={`${formId}-durationMinutes`} name="durationMinutes" type="number" min="5" max="480" step="5" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} required /></label>
            <label htmlFor={`${formId}-bufferMinutes`}>Preparación entre turnos<input id={`${formId}-bufferMinutes`} name="bufferMinutes" type="number" min="0" max="180" step="5" value={bufferMinutes} onChange={(event) => setBufferMinutes(Number(event.target.value))} required /></label>
            <label htmlFor={`${formId}-startIntervalMinutes`}>Frecuencia de inicio<select id={`${formId}-startIntervalMinutes`} name="startIntervalMinutes" value={startIntervalMinutes} onChange={(event) => setStartIntervalMinutes(Number(event.target.value) as 15 | 30 | 60)} required><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">60 minutos</option></select><small>Define cada cuánto puede comenzar. No modifica su duración.</small></label>
          </div>
          <div className="admin-scheduling-explainer" aria-live="polite"><div><span>Duración</span><strong>{durationMinutes} min</strong></div><div><span>Preparación</span><strong>{bufferMinutes} min</strong></div><div><span>Puede comenzar cada</span><strong>{startIntervalMinutes} min</strong></div><p>Cada reserva ocupa <strong>{durationMinutes + bufferMinutes} minutos</strong>.</p></div>
          {treatment && treatment.future_booking_count > 0 ? <label className="admin-impact-check" htmlFor={`${formId}-confirmImpact`}><input id={`${formId}-confirmImpact`} type="checkbox" name="confirmImpact" required={actionState.error === "impact"} /><span><strong>{treatment.future_booking_count} reservas futuras.</strong> Confirmo cambios que puedan afectar su agenda.</span><FieldError id={`${formId}-confirmImpact-error`} messages={fieldError("confirmImpact")} /></label> : null}
        </fieldset>

        <fieldset>
          <legend>Imagen del tratamiento</legend>
          <p className="admin-fieldset-intro">Se prepara en tu dispositivo, se sube directamente al espacio seguro y se verifica antes de guardar.</p>
          <div className="admin-treatment-image-control">
            <div className="admin-treatment-image-preview">{imagePreview ? <Image src={imagePreview} alt="Vista previa de la imagen seleccionada" fill sizes="260px" style={{ objectPosition: `${focalX}% ${focalY}%` }} /> : <span><ImageIcon aria-hidden="true" strokeWidth={1.75} />Todavía no hay una imagen</span>}</div>
            <div className="admin-treatment-image-fields">
              <label htmlFor={`${formId}-imageFile`}>Subir o reemplazar imagen<input id={`${formId}-imageFile`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={mediaBusy} aria-invalid={Boolean(mediaIssue || fieldError("imagePath")) || undefined} onChange={(event) => void uploadImage(event.target.files?.[0], event.currentTarget)} /><small>JPG, PNG, WebP o AVIF. Mínimo 640 × 640 px, máximo 4 MB.</small><FieldError id={`${formId}-imagePath-error`} messages={mediaIssue ? [mediaIssue] : fieldError("imagePath")} /></label>
              <div className={`admin-media-status admin-media-status--${mediaStage}`} role="status" aria-live="polite">{mediaBusy ? <LoaderCircle aria-hidden="true" className="admin-media-status__spinner" /> : mediaStage === "completed" ? <Check aria-hidden="true" /> : mediaStage === "failed" ? <AlertCircle aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}<span>{mediaStageLabels[mediaStage]}{mediaMetadata ? <small>{mediaMetadata}</small> : null}</span></div>
              <label htmlFor={`${formId}-imageAlt`}>Descripción accesible<input id={`${formId}-imageAlt`} name="imageAlt" defaultValue={treatment?.image_alt ?? ""} minLength={3} maxLength={240} aria-invalid={Boolean(fieldError("imageAlt")) || undefined} /><small>Describí lo visible sin repetir el nombre.</small><FieldError id={`${formId}-imageAlt-error`} messages={fieldError("imageAlt")} /></label>
            </div>
          </div>
          <div className="admin-form-grid"><label htmlFor={`${formId}-focalX`}>Foco horizontal: <output>{focalX}%</output><input id={`${formId}-focalX`} name="focalX" type="range" min="0" max="100" value={focalX} onChange={(event) => setFocalX(Number(event.target.value))} /></label><label htmlFor={`${formId}-focalY`}>Foco vertical: <output>{focalY}%</output><input id={`${formId}-focalY`} name="focalY" type="range" min="0" max="100" value={focalY} onChange={(event) => setFocalY(Number(event.target.value))} /></label></div>
        </fieldset>

        <div className="admin-form-footer admin-treatment-editor-footer"><p>Guardar borrador no publica. Publicar requiere imagen, descripción accesible y precio mayor que cero.</p><EditorSubmitButtons isNew={isNew} isPublished={Boolean(treatment?.is_active)} mediaBusy={mediaBusy} /></div>
      </form>

      <aside className="admin-treatment-editor-side" aria-label="Estado del tratamiento">
        <strong>{treatment?.is_active ? "Publicado" : "Borrador"}</strong>
        <p>La URL queda estable después del primer guardado.</p>
        {isDirty ? <p className="admin-unsaved-note" role="status">Tenés cambios sin guardar.</p> : null}
        {!isNew && treatment?.image_url ? <Link className="button button--quiet" href={`/admin/catalogo/${treatment.id}/preview`}><Eye aria-hidden="true" strokeWidth={1.75} />Abrir vista previa</Link> : null}
        <Link className="button button--quiet" href="/admin/catalogo">Volver al catálogo</Link>
        {!isNew && treatment ? <DeleteTreatmentForm treatment={treatment} /> : null}
      </aside>
    </div>
  );
}
