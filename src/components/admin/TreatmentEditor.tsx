"use client";

import { AlertCircle, Check, Eye, ImageIcon, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteTreatment,
  saveTreatment,
} from "@/app/admin/catalogo/actions";
import {
  createTreatmentMediaUploadIntent,
  finalizeTreatmentMediaUpload,
} from "@/app/admin/catalogo/media-actions";
import { focalPointToPercentage, linesToAdminText } from "@/lib/admin/catalog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  initialSaveTreatmentState,
  type SaveTreatmentState,
} from "@/lib/admin/treatment-action-state";
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
  return <span className="admin-field-error" id={id}>{messages[0]}</span>;
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
      <button className="button button--quiet" type="submit" name="submitIntent" value="draft" formNoValidate disabled={disabled}>
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
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>(treatment?.professional_ids ?? (treatment?.professional_id ? [treatment.professional_id] : []));
  const [durationMinutes, setDurationMinutes] = useState(treatment?.duration_minutes ?? 60);
  const [bufferMinutes, setBufferMinutes] = useState(treatment?.buffer_minutes ?? 15);
  const [startIntervalMinutes, setStartIntervalMinutes] = useState<15 | 30 | 60>(treatment?.start_interval_minutes ?? 30);
  const [selectionMode, setSelectionMode] = useState<"simple" | "closed_combo" | "combo_with_extras">(treatment?.selection_mode ?? "simple");
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
    item.is_active || selectedProfessionals.includes(item.id),
  ), [professionals, selectedProfessionals]);
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
      if (!intentResult.ok) {
        console.error("treatment_media_intent_result", {
          error: intentResult.error,
          incidentId: intentResult.incidentId,
        });
        throw new Error(`intent_${intentResult.error}_${intentResult.incidentId}`);
      }
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
          blobType: normalized.blob.type,
          blobSize: normalized.blob.size,
          errorName: uploadError.name,
        });
        throw new Error("upload_failed");
      }
      if (sequence !== uploadSequence.current) return;
      setMediaStage("processing");
      const finalized = await finalizeTreatmentMediaUpload(intentResult.intent.id);
      if (!finalized.ok) {
        console.error("treatment_media_finalize_result", {
          error: finalized.error,
          incidentId: finalized.incidentId,
        });
        throw new Error(`finalize_${finalized.error}_${finalized.incidentId}`);
      }
      if (sequence !== uploadSequence.current) return;
      setImagePath(finalized.imagePath);
      setMediaStage("completed");
      setIsDirty(true);
    } catch (error) {
      if (sequence !== uploadSequence.current) return;
      const rawCode = error instanceof Error ? error.message : "unknown";
      const code = rawCode.split(":")[0] ?? "unknown";
      console.error("treatment_media_flow_failed", { code });
      const message = code === "image_too-small"
        ? "La imagen debe tener al menos 640 × 640 píxeles."
        : code === "image_too-large"
          ? "La imagen supera los 40 megapíxeles permitidos."
          : code === "image_size"
            ? "La imagen supera el máximo de 4 MB."
            : code === "image_decode_failed"
              ? "El navegador no pudo leer esta imagen. Probá exportarla otra vez como JPG, PNG o WebP."
            : code === "image_normalization_failed"
              ? "Tu navegador no pudo convertir la imagen a WebP. Probá con JPG."
              : code === "image_canvas_unavailable"
                ? "Tu navegador no soporta la preparación de imagen en canvas."
                : code === "upload_failed"
                  ? "No pudimos subir la imagen. Revisá tu conexión e intentá nuevamente."
                  : code.startsWith("intent_") || code.startsWith("finalize_")
                    ? (() => {
                        const parts = code.split("_");
                        const stage = parts[0];
                        const reason = parts[1] ?? "unknown";
                        const support = parts[2] ?? "";
                        return `${stage === "intent" ? "La preparación" : "La finalización"} falló (${reason}). Código de soporte: ${support}`;
                      })()
                    : "No pudimos preparar la imagen. Intentá nuevamente o contactá a soporte.";
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
            <label htmlFor={`${formId}-name`}>Nombre<input id={`${formId}-name`} name="name" defaultValue={treatment?.name ?? ""} minLength={2} maxLength={120} required aria-invalid={Boolean(fieldError("name")) || undefined} aria-describedby={fieldError("name") ? `${formId}-name-error` : undefined} /><FieldError id={`${formId}-name-error`} messages={fieldError("name")} /></label>
            <label htmlFor={`${formId}-categoryId`}>Categoría<select id={`${formId}-categoryId`} name="categoryId" defaultValue={treatment?.category_id ?? ""} required aria-invalid={Boolean(fieldError("categoryId")) || undefined} aria-describedby={fieldError("categoryId") ? `${formId}-categoryId-error` : undefined}><option value="">Seleccionar</option>{categories.filter((item) => item.is_active || item.id === treatment?.category_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><FieldError id={`${formId}-categoryId-error`} messages={fieldError("categoryId")} /></label>
            <label htmlFor={`${formId}-displayOrder`}>Orden<input id={`${formId}-displayOrder`} name="displayOrder" type="number" min="0" max="999" defaultValue={treatment?.display_order ?? 0} required /></label>
          </div>
          <label htmlFor={`${formId}-shortDescription`}>Descripción breve<textarea id={`${formId}-shortDescription`} name="shortDescription" defaultValue={treatment?.short_description ?? ""} rows={2} minLength={10} maxLength={240} required aria-invalid={Boolean(fieldError("shortDescription")) || undefined} aria-describedby={fieldError("shortDescription") ? `${formId}-shortDescription-error` : undefined} /><FieldError id={`${formId}-shortDescription-error`} messages={fieldError("shortDescription")} /></label>
          <label htmlFor={`${formId}-description`}>Detalle completo<textarea id={`${formId}-description`} name="description" defaultValue={treatment?.description ?? ""} rows={5} minLength={20} maxLength={3000} required aria-invalid={Boolean(fieldError("description")) || undefined} aria-describedby={fieldError("description") ? `${formId}-description-error` : undefined} /><FieldError id={`${formId}-description-error`} messages={fieldError("description")} /></label>
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
          <div className="admin-selection-mode">
            <label htmlFor={`${formId}-selectionMode`}>Forma de reserva
              <select id={`${formId}-selectionMode`} name="selectionMode" value={selectionMode} onChange={(event) => setSelectionMode(event.target.value as "simple" | "closed_combo" | "combo_with_extras")} aria-invalid={Boolean(fieldError("selectionMode")) || undefined}>
                <option value="simple">Tratamiento simple</option>
                <option value="closed_combo">Usa combos cerrados</option>
                <option value="combo_with_extras">Combos con extras opcionales</option>
              </select>
              <small>{selectionMode !== "simple" ? "La persona deberá elegir un combo publicado antes de reservar." : "La duración y el precio de esta ficha se aplican directamente."}</small>
              <FieldError id={`${formId}-selectionMode-error`} messages={fieldError("selectionMode")} />
            </label>
            {selectionMode !== "simple" && treatment?.selection_mode !== "simple" ? <Link className="button button--quiet" href={`/admin/catalogo/${treatmentId}/combos`}>Configurar zonas, combos y extras</Link> : null}
            {selectionMode !== "simple" && (isNew || treatment?.selection_mode === "simple") ? <p className="admin-field-note">Guardá primero el tratamiento con esta forma de reserva para poder configurar sus zonas, combos y extras.</p> : null}
            {!isNew ? <Link className="button button--quiet" href={`/admin/mensajes?treatmentId=${treatmentId}`}>Personalizar mensajes de WhatsApp</Link> : null}
          </div>
          <div className={`admin-form-grid ${selectionMode === "simple" ? "admin-form-grid--3" : ""}`}>
            <label htmlFor={`${formId}-specialtyId`}>Especialidad<select id={`${formId}-specialtyId`} name="specialtyId" value={selectedSpecialty} onChange={(event) => { setSelectedSpecialty(event.target.value); }} required aria-invalid={Boolean(fieldError("specialtyId")) || undefined} aria-describedby={fieldError("specialtyId") ? `${formId}-specialtyId-error` : undefined}><option value="">Seleccionar</option>{activeSpecialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><FieldError id={`${formId}-specialtyId-error`} messages={fieldError("specialtyId")} /></label>
            {selectionMode === "simple" ? <label htmlFor={`${formId}-pricePesos`}>Precio en pesos<input id={`${formId}-pricePesos`} name="pricePesos" type="number" min="0" step="1" defaultValue={treatment ? treatment.price_cents / 100 : ""} aria-invalid={Boolean(fieldError("pricePesos")) || undefined} aria-describedby={fieldError("pricePesos") ? `${formId}-pricePesos-error` : undefined} /><FieldError id={`${formId}-pricePesos-error`} messages={fieldError("pricePesos")} /></label> : <input type="hidden" name="pricePesos" value="0" />}
          </div>
          <input type="hidden" name="requiresProfessionalAssignment" value="true" />
          <fieldset className="depilation-zone-picker" aria-describedby={`${formId}-professionalIds-error`}>
            <legend>Profesionales que pueden atenderlo</legend>
            {availableProfessionals.length === 0 ? <p className="admin-field-note">Primero cargá profesionales activos. El tratamiento no debería publicarse sin al menos una persona asignada.</p> : availableProfessionals.map((item) => <label className="admin-check" key={item.id}><input type="checkbox" name="professionalIds" value={item.id} checked={selectedProfessionals.includes(item.id)} onChange={(event) => setSelectedProfessionals((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span><strong>{item.public_name || item.full_name}</strong><small>{item.is_active ? "Activo" : "Inactivo"}</small></span></label>)}
            <FieldError id={`${formId}-professionalIds-error`} messages={fieldError("professionalIds")} />
          </fieldset>
          {selectionMode === "closed_combo" ? <div className="admin-field-note admin-field-note--prominent"><strong>Precio y duración se definen en cada combo.</strong><span>La duración real será la suma de sus zonas más un único margen de preparación. La frecuencia continúa siendo común a este tratamiento.</span><input type="hidden" name="durationMinutes" value={durationMinutes} /></div> : null}
          <div className={`admin-form-grid ${selectionMode === "simple" ? "admin-form-grid--3" : ""}`}>
            {selectionMode === "simple" ? <label htmlFor={`${formId}-durationMinutes`}>Duración<input id={`${formId}-durationMinutes`} name="durationMinutes" type="number" min="5" max="480" step="5" value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} required /></label> : null}
            <label htmlFor={`${formId}-bufferMinutes`}>Preparación entre turnos<input id={`${formId}-bufferMinutes`} name="bufferMinutes" type="number" min="0" max="180" step="5" value={bufferMinutes} onChange={(event) => setBufferMinutes(Number(event.target.value))} required /></label>
            <label htmlFor={`${formId}-startIntervalMinutes`}>Frecuencia de inicio<select id={`${formId}-startIntervalMinutes`} name="startIntervalMinutes" value={startIntervalMinutes} onChange={(event) => setStartIntervalMinutes(Number(event.target.value) as 15 | 30 | 60)} required><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">60 minutos</option></select><small>Define cada cuánto puede comenzar. No modifica su duración.</small></label>
          </div>
          <div className="admin-scheduling-explainer" aria-live="polite">{selectionMode === "simple" ? <div><span>Duración</span><strong>{durationMinutes} min</strong></div> : <div><span>Duración</span><strong>Según zonas</strong></div>}<div><span>Preparación</span><strong>{bufferMinutes} min</strong></div><div><span>Puede comenzar cada</span><strong>{startIntervalMinutes} min</strong></div><p>{selectionMode === "simple" ? <>Cada reserva ocupa <strong>{durationMinutes + bufferMinutes} minutos</strong>.</> : <>Cada reserva ocupa <strong>la suma de zonas + {bufferMinutes} minutos</strong>.</>}</p></div>
          {treatment && treatment.future_booking_count > 0 ? <label className="admin-impact-check" htmlFor={`${formId}-confirmImpact`}><input id={`${formId}-confirmImpact`} type="checkbox" name="confirmImpact" required={actionState.error === "impact"} /><span><strong>{treatment.future_booking_count} reservas futuras.</strong> Confirmo cambios que puedan afectar su agenda.</span><FieldError id={`${formId}-confirmImpact-error`} messages={fieldError("confirmImpact")} /></label> : null}
        </fieldset>

        <fieldset>
          <legend>Imagen del tratamiento</legend>
          <p className="admin-fieldset-intro">Se prepara en tu dispositivo, se sube directamente al espacio seguro y se verifica antes de guardar.</p>
          <div className="admin-treatment-image-control">
            <div className="admin-treatment-image-preview">{imagePreview ? <Image src={imagePreview} alt="Vista previa de la imagen seleccionada" fill sizes="260px" style={{ objectPosition: `${focalX}% ${focalY}%` }} /> : <span><ImageIcon aria-hidden="true" strokeWidth={1.75} />Todavía no hay una imagen</span>}</div>
            <div className="admin-treatment-image-fields">
              <label htmlFor={`${formId}-imageFile`}>Subir o reemplazar imagen <small>opcional</small><input id={`${formId}-imageFile`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={mediaBusy} aria-invalid={Boolean(mediaIssue || fieldError("imagePath")) || undefined} aria-describedby={`${formId}-imageFile-help${mediaIssue || fieldError("imagePath") ? ` ${formId}-imagePath-error` : ""}`} onChange={(event) => void uploadImage(event.target.files?.[0], event.currentTarget)} /><small id={`${formId}-imageFile-help`}>Podés guardar o publicar el tratamiento sin imagen y agregarla después. JPG, PNG, WebP o AVIF; mínimo 640 × 640 px y máximo 4 MB.</small><FieldError id={`${formId}-imagePath-error`} messages={mediaIssue ? [mediaIssue] : fieldError("imagePath")} /></label>
              <div className={`admin-media-status admin-media-status--${mediaStage}`} role="status" aria-live="polite">{mediaBusy ? <LoaderCircle aria-hidden="true" className="admin-media-status__spinner" /> : mediaStage === "completed" ? <Check aria-hidden="true" /> : mediaStage === "failed" ? <AlertCircle aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}<span>{mediaStageLabels[mediaStage]}{mediaMetadata ? <small>{mediaMetadata}</small> : null}</span></div>
              <label htmlFor={`${formId}-imageAlt`}>Descripción accesible<input id={`${formId}-imageAlt`} name="imageAlt" defaultValue={treatment?.image_alt ?? ""} minLength={3} maxLength={240} aria-invalid={Boolean(fieldError("imageAlt")) || undefined} aria-describedby={fieldError("imageAlt") ? `${formId}-imageAlt-error` : undefined} /><small>Describí lo visible sin repetir el nombre.</small><FieldError id={`${formId}-imageAlt-error`} messages={fieldError("imageAlt")} /></label>
            </div>
          </div>
          <div className="admin-form-grid"><label htmlFor={`${formId}-focalX`}>Foco horizontal: <output>{focalX}%</output><input id={`${formId}-focalX`} name="focalX" type="range" min="0" max="100" value={focalX} onChange={(event) => setFocalX(Number(event.target.value))} /></label><label htmlFor={`${formId}-focalY`}>Foco vertical: <output>{focalY}%</output><input id={`${formId}-focalY`} name="focalY" type="range" min="0" max="100" value={focalY} onChange={(event) => setFocalY(Number(event.target.value))} /></label></div>
        </fieldset>

        <div className="admin-form-footer admin-treatment-editor-footer"><p>La imagen es opcional y puede agregarse o reemplazarse después. Si cargás una, su descripción accesible sí es obligatoria.</p><EditorSubmitButtons isNew={isNew} isPublished={Boolean(treatment?.is_active)} mediaBusy={mediaBusy} /></div>
      </form>

      <aside className="admin-treatment-editor-side" aria-label="Estado del tratamiento">
        <strong>{treatment?.is_active ? "Publicado" : "Borrador"}</strong>
        <p>La URL queda estable después del primer guardado.</p>
        {isDirty ? <p className="admin-unsaved-note" role="status">Tenés cambios sin guardar.</p> : null}
        {!isNew && treatment ? <Link className="button button--quiet" href={`/admin/catalogo/${treatment.id}/preview`}><Eye aria-hidden="true" strokeWidth={1.75} />Abrir vista previa</Link> : null}
        <Link className="button button--quiet" href="/admin/catalogo">Volver al catálogo</Link>
        {!isNew && treatment ? <DeleteTreatmentForm treatment={treatment} /> : null}
      </aside>
    </div>
  );
}
