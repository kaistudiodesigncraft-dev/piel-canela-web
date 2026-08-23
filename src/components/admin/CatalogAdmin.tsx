"use client";

import { ChevronDown, Eye, ImageIcon, Plus, Search } from "lucide-react";
import { FlowerLotus, PersonArmsSpread, UserFocus } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  initialSaveTreatmentState,
  saveTreatment,
  type SaveTreatmentState,
  updateTreatmentCategory,
} from "@/app/admin/catalogo/actions";
import {
  focalPointToPercentage,
  getTreatmentPublicationState,
  linesToAdminText,
} from "@/lib/admin/catalog";
import { inspectAdminImage } from "@/lib/admin/image-upload";
import { formatDuration, formatPrice } from "@/lib/format";

export interface AdminCategoryRow {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
}

export interface AdminSpecialtyRow {
  id: string;
  name: string;
  is_active: boolean;
}

export interface AdminProfessionalRow {
  id: string;
  specialty_id: string;
  full_name: string;
  public_name: string | null;
  is_active: boolean;
}

export interface AdminTreatmentRow {
  id: string;
  category_id: string;
  specialty_id: string;
  professional_id: string | null;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  expectations: string[];
  characteristics: string[];
  duration_minutes: number;
  buffer_minutes: number;
  price_cents: number;
  preparation: string | null;
  contraindications: string | null;
  image_path: string | null;
  image_url: string | null;
  image_alt: string | null;
  image_focal_x: number | string;
  image_focal_y: number | string;
  is_active: boolean;
  display_order: number;
  future_booking_count: number;
}

interface CatalogAdminProps {
  categories: AdminCategoryRow[];
  specialties: AdminSpecialtyRow[];
  professionals: AdminProfessionalRow[];
  treatments: AdminTreatmentRow[];
  feedback: Record<string, string | undefined>;
}

const publicationLabels = {
  published: "Publicado",
  ready: "Listo para publicar",
  draft: "Borrador incompleto",
} as const;

function CategoryIcon({ name }: { name: string }) {
  const Icon = name === "FlowerLotus" ? FlowerLotus : name === "PersonArmsSpread" ? PersonArmsSpread : UserFocus;
  return <Icon aria-hidden="true" weight="regular" />;
}

function Feedback({ success, error }: { success?: boolean; error?: string }) {
  if (success) return <p className="form-message" role="status">Los cambios quedaron guardados.</p>;
  if (!error) return null;
  const messages: Record<string, string> = {
    impact: "Hay reservas futuras afectadas. Revisá el impacto y confirmá antes de guardar.",
    publishable: "Para publicar necesitás una imagen y su descripción accesible.",
    professional: "El profesional debe estar activo y pertenecer a la especialidad elegida.",
    duplicate: "Ya existe otro tratamiento con ese nombre o URL.",
    lists: "Las características o expectativas superan la extensión permitida.",
    image: "La imagen debe ser JPG, PNG, WebP o AVIF y pesar menos de 8 MB.",
    "image-dimensions": "La imagen no tiene dimensiones aptas para el catálogo.",
    upload: "La imagen no pudo cargarse.",
    taxonomy: "La categoría o especialidad seleccionada no está disponible.",
  };
  return <p className="form-message form-message--error" role="alert">{messages[error] ?? "No se pudieron guardar los cambios. Revisá los campos e intentá nuevamente."}</p>;
}

const treatmentErrorMessages: Record<string, string> = {
  impact: "El cambio puede afectar reservas futuras.",
  publishable: "Faltan datos necesarios para publicar.",
  professional: "La asignación profesional no es válida.",
  duplicate: "La URL del tratamiento ya está en uso.",
  lists: "Revisá las listas de información pública.",
  image: "El archivo seleccionado no es una imagen válida.",
  "image-dimensions": "La imagen no tiene dimensiones aptas para el catálogo.",
  upload: "No pudimos cargar la imagen.",
  taxonomy: "La categoría o especialidad ya no está disponible.",
  missing: "El tratamiento ya no existe o no está disponible.",
  invalid: "Hay datos que necesitan corrección.",
  save: "No pudimos guardar el tratamiento.",
};

function TreatmentActionFeedback({ state, formId }: { state: SaveTreatmentState; formId: string }) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") feedbackRef.current?.focus();
  }, [state]);
  if (state.status !== "error") return null;
  const fields = Object.entries(state.fieldErrors ?? {});
  return (
    <div className="form-message form-message--error admin-form-error-summary" role="alert" tabIndex={-1} ref={feedbackRef}>
      <strong>{treatmentErrorMessages[state.error ?? ""] ?? "No pudimos guardar los cambios."}</strong>
      {fields.length > 0 ? (
        <ul>
          {fields.map(([field, message]) => <li key={field}><a href={`#${formId}-${field}`}>{message}</a></li>)}
        </ul>
      ) : <p>Intentá nuevamente. Si el problema continúa, comunicate con Kai Studio.</p>}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <span className="admin-field-error" id={id} role="alert">{message}</span>;
}

function TreatmentSubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button--primary" type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Guardando…" : editing ? "Guardar tratamiento" : "Crear borrador"}
    </button>
  );
}

export function CatalogAdmin({ categories, specialties, professionals, treatments, feedback }: CatalogAdminProps) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "published" | "ready" | "draft">("all");
  const categoryName = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const specialtyName = useMemo(() => new Map(specialties.map((item) => [item.id, item.name])), [specialties]);
  const filtered = treatments.filter((treatment) => {
    const state = getTreatmentPublicationState({ isActive: treatment.is_active, imagePath: treatment.image_path, imageAlt: treatment.image_alt });
    if (stateFilter !== "all" && state !== stateFilter) return false;
    return `${treatment.name} ${categoryName.get(treatment.category_id)} ${specialtyName.get(treatment.specialty_id)}`
      .toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR"));
  });

  return (
    <>
      <section className="live-admin__section admin-catalog-section" id="tratamientos" aria-labelledby="catalog-title">
        <div className="admin-section-heading">
          <div><h2 id="catalog-title">Tratamientos</h2><p>Administrá la información comercial y operativa que alimenta el catálogo y el turnero.</p></div>
          <span className="admin-count numeric">{filtered.length} resultados</span>
        </div>
        <Feedback success={feedback.treatmentSaved === "1"} error={feedback.treatmentError} />
        <details className="admin-disclosure admin-create-disclosure">
          <summary><span><Plus aria-hidden="true" strokeWidth={1.75} />Crear tratamiento</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary>
          <TreatmentForm categories={categories} specialties={specialties} professionals={professionals} />
        </details>
        <div className="admin-booking-toolbar">
          <label className="admin-search"><Search aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Buscar tratamientos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tratamiento, categoría o especialidad" /></label>
          <label><span className="sr-only">Filtrar publicación</span><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}><option value="all">Todos los estados</option><option value="published">Publicados</option><option value="ready">Listos para publicar</option><option value="draft">Borradores incompletos</option></select></label>
        </div>
        {filtered.length === 0 ? <div className="admin-empty"><ImageIcon aria-hidden="true" strokeWidth={1.75} /><h3>No hay tratamientos para esta vista.</h3><p>Probá otro filtro o creá un nuevo borrador.</p></div> : (
          <div className="admin-treatment-manager-list">
            {filtered.map((treatment) => {
              const state = getTreatmentPublicationState({ isActive: treatment.is_active, imagePath: treatment.image_path, imageAlt: treatment.image_alt });
              return (
                <details key={treatment.id} className="admin-treatment-manager-item" id={`treatment-${treatment.id}`}>
                  <summary className="admin-treatment-manager-item__summary">
                    <div className="admin-treatment-manager-item__image">
                      {treatment.image_url ? <Image src={treatment.image_url} alt={treatment.image_alt ?? ""} fill sizes="96px" style={{ objectPosition: `${focalPointToPercentage(treatment.image_focal_x)}% ${focalPointToPercentage(treatment.image_focal_y)}%` }} /> : <ImageIcon aria-hidden="true" strokeWidth={1.75} />}
                    </div>
                    <div><span className={`status-badge status-${state === "published" ? "confirmed" : state === "ready" ? "awaiting_deposit" : "expired"}`}>{publicationLabels[state]}</span><h3>{treatment.name}</h3><p>{categoryName.get(treatment.category_id)} · {specialtyName.get(treatment.specialty_id)}</p></div>
                    <div className="admin-treatment-manager-item__facts numeric"><span>{formatDuration(treatment.duration_minutes)} + {treatment.buffer_minutes} min</span><strong>{formatPrice(treatment.price_cents)}</strong>{treatment.future_booking_count > 0 ? <small>{treatment.future_booking_count} reservas futuras</small> : null}</div>
                    <span className="admin-treatment-manager-item__edit">Editar <ChevronDown aria-hidden="true" strokeWidth={1.75} /></span>
                  </summary>
                  <div className="admin-treatment-manager-item__editor">
                    {treatment.image_url ? <Link className="button button--quiet" href={`/admin/catalogo/${treatment.id}/preview`}><Eye aria-hidden="true" strokeWidth={1.75} />Abrir vista previa</Link> : null}
                    <TreatmentForm categories={categories} specialties={specialties} professionals={professionals} treatment={treatment} />
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="live-admin__section" id="categorias" aria-labelledby="categories-title">
        <div className="admin-section-heading"><div><h2 id="categories-title">Categorías del catálogo</h2><p>Las tres entradas de la home son estructurales. Podés ajustar sus nombres y explicaciones, no crear ni eliminar categorías.</p></div></div>
        <Feedback success={feedback.categorySaved === "1"} error={feedback.categoryError} />
        <div className="admin-category-editor-grid">
          {categories.map((category) => <form action={updateTreatmentCategory} className="admin-form" key={category.id}><input type="hidden" name="categoryId" value={category.id} /><div className="admin-category-editor-grid__identity"><CategoryIcon name={category.icon_name} /><small>URL estable: /tratamientos?categoria={category.slug}</small></div><label>Nombre<input name="name" defaultValue={category.name} minLength={2} maxLength={80} required /></label><label>Explicación breve<textarea name="shortDescription" defaultValue={category.short_description} rows={3} minLength={10} maxLength={240} required /></label><button className="button button--primary" type="submit">Guardar categoría</button></form>)}
        </div>
      </section>
    </>
  );
}

function TreatmentForm({ categories, specialties, professionals, treatment }: { categories: AdminCategoryRow[]; specialties: AdminSpecialtyRow[]; professionals: AdminProfessionalRow[]; treatment?: AdminTreatmentRow }) {
  const formId = `treatment-${treatment?.id ?? "new"}`;
  const [actionState, formAction] = useActionState(saveTreatment, initialSaveTreatmentState);
  const activeSpecialties = specialties.filter((item) => item.is_active || item.id === treatment?.specialty_id);
  const [selectedSpecialty, setSelectedSpecialty] = useState(treatment?.specialty_id ?? "");
  const [selectedProfessional, setSelectedProfessional] = useState(treatment?.professional_id ?? "");
  const [focalX, setFocalX] = useState(focalPointToPercentage(treatment?.image_focal_x ?? 0.5));
  const [focalY, setFocalY] = useState(focalPointToPercentage(treatment?.image_focal_y ?? 0.5));
  const [isActive, setIsActive] = useState(treatment?.is_active ?? false);
  const [imagePreview, setImagePreview] = useState(treatment?.image_url ?? null);
  const [imageIssue, setImageIssue] = useState<string | null>(null);
  const [imageMetadata, setImageMetadata] = useState<string | null>(null);
  const imageValidationSequence = useRef(0);
  const availableProfessionals = professionals.filter((item) =>
    item.specialty_id === selectedSpecialty && (item.is_active || item.id === treatment?.professional_id),
  );
  const fieldError = (name: string) => actionState.fieldErrors?.[name];

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  async function previewSelectedImage(file: File | undefined, input: HTMLInputElement) {
    const validationSequence = ++imageValidationSequence.current;
    setImagePreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : (treatment?.image_url ?? null);
    });
    setImageIssue(null);
    setImageMetadata(null);
    input.setCustomValidity("");
    if (!file) return;
    const inspection = await inspectAdminImage(file);
    if (validationSequence !== imageValidationSequence.current) return;
    if (inspection.valid) {
      setImageMetadata(`${inspection.width} × ${inspection.height} px`);
      return;
    }
    const message = inspection.error === "too-small"
      ? "La imagen debe tener al menos 640 × 640 píxeles."
      : inspection.error === "too-large"
        ? "La imagen supera los 40 megapíxeles permitidos."
        : inspection.error === "size"
          ? "La imagen supera el máximo de 8 MB."
          : "El archivo no contiene una imagen JPG, PNG, WebP o AVIF válida.";
    input.setCustomValidity(message);
    setImageIssue(message);
  }

  return (
    <form action={formAction} className="admin-form admin-form--treatment">
      {treatment ? <input type="hidden" name="treatmentId" value={treatment.id} /> : null}
      <TreatmentActionFeedback state={actionState} formId={formId} />

      <fieldset>
        <legend>Información pública</legend>
        <div className="admin-form-grid admin-form-grid--3">
          <label htmlFor={`${formId}-name`}>Nombre
            <input id={`${formId}-name`} name="name" defaultValue={treatment?.name ?? ""} minLength={2} maxLength={120} required aria-invalid={Boolean(fieldError("name")) || undefined} aria-describedby={fieldError("name") ? `${formId}-name-error` : undefined} />
            <FieldError id={`${formId}-name-error`} message={fieldError("name")} />
          </label>
          <label htmlFor={`${formId}-categoryId`}>Categoría
            <select id={`${formId}-categoryId`} name="categoryId" defaultValue={treatment?.category_id ?? ""} required aria-invalid={Boolean(fieldError("categoryId")) || undefined} aria-describedby={fieldError("categoryId") ? `${formId}-categoryId-error` : undefined}>
              <option value="">Seleccionar</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <FieldError id={`${formId}-categoryId-error`} message={fieldError("categoryId")} />
          </label>
          <label htmlFor={`${formId}-displayOrder`}>Orden
            <input id={`${formId}-displayOrder`} name="displayOrder" type="number" min="0" max="999" defaultValue={treatment?.display_order ?? 0} required />
          </label>
        </div>
        <label htmlFor={`${formId}-shortDescription`}>Descripción breve
          <textarea id={`${formId}-shortDescription`} name="shortDescription" defaultValue={treatment?.short_description ?? ""} rows={2} minLength={10} maxLength={240} required aria-invalid={Boolean(fieldError("shortDescription")) || undefined} aria-describedby={fieldError("shortDescription") ? `${formId}-shortDescription-error` : undefined} />
          <FieldError id={`${formId}-shortDescription-error`} message={fieldError("shortDescription")} />
        </label>
        <label htmlFor={`${formId}-description`}>Detalle completo
          <textarea id={`${formId}-description`} name="description" defaultValue={treatment?.description ?? ""} rows={4} minLength={20} maxLength={3000} required aria-invalid={Boolean(fieldError("description")) || undefined} aria-describedby={fieldError("description") ? `${formId}-description-error` : undefined} />
          <FieldError id={`${formId}-description-error`} message={fieldError("description")} />
        </label>
        <div className="admin-form-grid">
          <label htmlFor={`${formId}-characteristics`}>Características de la ficha
            <small>Hasta tres, una por línea.</small>
            <textarea id={`${formId}-characteristics`} name="characteristics" defaultValue={linesToAdminText(treatment?.characteristics ?? [])} rows={4} aria-invalid={Boolean(fieldError("characteristics")) || undefined} aria-describedby={fieldError("characteristics") ? `${formId}-characteristics-error` : undefined} />
            <FieldError id={`${formId}-characteristics-error`} message={fieldError("characteristics")} />
          </label>
          <label htmlFor={`${formId}-expectations`}>Qué puede esperar la persona
            <small>Una idea por línea.</small>
            <textarea id={`${formId}-expectations`} name="expectations" defaultValue={linesToAdminText(treatment?.expectations ?? [])} rows={4} aria-invalid={Boolean(fieldError("expectations")) || undefined} aria-describedby={fieldError("expectations") ? `${formId}-expectations-error` : undefined} />
            <FieldError id={`${formId}-expectations-error`} message={fieldError("expectations")} />
          </label>
        </div>
        <div className="admin-form-grid">
          <label htmlFor={`${formId}-preparation`}>Preparación opcional
            <textarea id={`${formId}-preparation`} name="preparation" defaultValue={treatment?.preparation ?? ""} rows={3} maxLength={1400} />
          </label>
          <label htmlFor={`${formId}-contraindications`}>Cuándo consultar antes
            <textarea id={`${formId}-contraindications`} name="contraindications" defaultValue={treatment?.contraindications ?? ""} rows={3} maxLength={1400} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Operación y precio</legend>
        <div className="admin-form-grid admin-form-grid--3">
          <label htmlFor={`${formId}-specialtyId`}>Especialidad
            <select id={`${formId}-specialtyId`} name="specialtyId" value={selectedSpecialty} onChange={(event) => { setSelectedSpecialty(event.target.value); setSelectedProfessional(""); }} required aria-invalid={Boolean(fieldError("specialtyId")) || undefined} aria-describedby={fieldError("specialtyId") ? `${formId}-specialtyId-error` : undefined}>
              <option value="">Seleccionar</option>
              {activeSpecialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <FieldError id={`${formId}-specialtyId-error`} message={fieldError("specialtyId")} />
          </label>
          <label htmlFor={`${formId}-professionalId`}>Profesional opcional
            <select id={`${formId}-professionalId`} name="professionalId" value={selectedProfessional} onChange={(event) => setSelectedProfessional(event.target.value)} aria-invalid={Boolean(fieldError("professionalId")) || undefined} aria-describedby={fieldError("professionalId") ? `${formId}-professionalId-error` : undefined}>
              <option value="">Sin asignación fija</option>
              {availableProfessionals.map((item) => <option key={item.id} value={item.id}>{item.public_name || item.full_name}</option>)}
            </select>
            <FieldError id={`${formId}-professionalId-error`} message={fieldError("professionalId")} />
          </label>
          <label htmlFor={`${formId}-pricePesos`}>Precio en pesos
            <input id={`${formId}-pricePesos`} name="pricePesos" type="number" min={isActive ? 1 : 0} step="1" defaultValue={treatment ? treatment.price_cents / 100 : ""} required aria-invalid={Boolean(fieldError("pricePesos")) || undefined} aria-describedby={fieldError("pricePesos") ? `${formId}-pricePesos-error` : undefined} />
            <FieldError id={`${formId}-pricePesos-error`} message={fieldError("pricePesos")} />
          </label>
        </div>
        <div className="admin-form-grid admin-form-grid--3">
          <label htmlFor={`${formId}-durationMinutes`}>Duración
            <input id={`${formId}-durationMinutes`} name="durationMinutes" type="number" min="5" max="480" step="5" defaultValue={treatment?.duration_minutes ?? 60} required aria-invalid={Boolean(fieldError("durationMinutes")) || undefined} aria-describedby={fieldError("durationMinutes") ? `${formId}-durationMinutes-error` : undefined} />
            <FieldError id={`${formId}-durationMinutes-error`} message={fieldError("durationMinutes")} />
          </label>
          <label htmlFor={`${formId}-bufferMinutes`}>Preparación entre turnos
            <input id={`${formId}-bufferMinutes`} name="bufferMinutes" type="number" min="0" max="180" step="5" defaultValue={treatment?.buffer_minutes ?? 15} required aria-invalid={Boolean(fieldError("bufferMinutes")) || undefined} />
          </label>
          <label className="admin-check" htmlFor={`${formId}-isActive`}>
            <input id={`${formId}-isActive`} type="checkbox" name="isActive" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            <span>Publicar y habilitar reservas</span>
          </label>
        </div>
        {treatment && treatment.future_booking_count > 0 ? (
          <label className="admin-impact-check" htmlFor={`${formId}-confirmImpact`}>
            <input id={`${formId}-confirmImpact`} type="checkbox" name="confirmImpact" required={actionState.error === "impact"} aria-invalid={Boolean(fieldError("confirmImpact")) || undefined} aria-describedby={fieldError("confirmImpact") ? `${formId}-confirmImpact-error` : undefined} />
            <span><strong>{treatment.future_booking_count} reservas futuras.</strong> Confirmo el cambio de duración, buffer o publicación si afecta la agenda.</span>
            <FieldError id={`${formId}-confirmImpact-error`} message={fieldError("confirmImpact")} />
          </label>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>Imagen propia del tratamiento</legend>
        <p className="admin-fieldset-intro">La fotografía se aplica a la ficha, el catálogo y el turnero sin afectar otros tratamientos.</p>
        <div className="admin-treatment-image-control">
          <div className="admin-treatment-image-preview">
            {imagePreview ? <Image src={imagePreview} alt="Vista previa de la imagen seleccionada" fill sizes="220px" style={{ objectPosition: `${focalX}% ${focalY}%` }} /> : <span><ImageIcon aria-hidden="true" strokeWidth={1.75} />Todavía no hay una imagen seleccionada</span>}
          </div>
          <div className="admin-treatment-image-fields">
            <label htmlFor={`${formId}-imageFile`}>Subir imagen {treatment ? "para reemplazar la actual" : ""}
              <input
                id={`${formId}-imageFile`}
                name="imageFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                required={isActive && !treatment?.image_path}
                aria-invalid={Boolean(imageIssue || fieldError("imageFile")) || undefined}
                aria-describedby={`${formId}-image-help${imageIssue || fieldError("imageFile") ? ` ${formId}-imageFile-error` : ""}`}
                onChange={(event) => void previewSelectedImage(event.target.files?.[0], event.currentTarget)}
              />
              <small id={`${formId}-image-help`}>JPG, PNG, WebP o AVIF. Mínimo 640 × 640 px, máximo 8 MB. Recomendado: relación vertical 4:5.</small>
              {imageMetadata ? <span className="admin-field-note" role="status">Imagen lista: {imageMetadata}</span> : null}
              <FieldError id={`${formId}-imageFile-error`} message={imageIssue ?? fieldError("imageFile")} />
            </label>
            <label htmlFor={`${formId}-imageAlt`}>Descripción accesible
              <input id={`${formId}-imageAlt`} name="imageAlt" defaultValue={treatment?.image_alt ?? ""} minLength={3} maxLength={240} required={isActive} aria-invalid={Boolean(fieldError("imageAlt")) || undefined} aria-describedby={`${formId}-imageAlt-help${fieldError("imageAlt") ? ` ${formId}-imageAlt-error` : ""}`} />
              <small id={`${formId}-imageAlt-help`}>Describí lo visible sin repetir el nombre del tratamiento.</small>
              <FieldError id={`${formId}-imageAlt-error`} message={fieldError("imageAlt")} />
            </label>
          </div>
        </div>
        <div className="admin-form-grid">
          <label htmlFor={`${formId}-focalX`}>Foco horizontal: <output htmlFor={`${formId}-focalX`}>{focalX}%</output>
            <input id={`${formId}-focalX`} name="focalX" type="range" min="0" max="100" value={focalX} onChange={(event) => setFocalX(Number(event.target.value))} />
          </label>
          <label htmlFor={`${formId}-focalY`}>Foco vertical: <output htmlFor={`${formId}-focalY`}>{focalY}%</output>
            <input id={`${formId}-focalY`} name="focalY" type="range" min="0" max="100" value={focalY} onChange={(event) => setFocalY(Number(event.target.value))} />
          </label>
        </div>
      </fieldset>

      <div className="admin-form-footer">
        <p>La URL se crea al guardar por primera vez y se mantiene estable. Los borradores no aparecen en el catálogo.</p>
        <TreatmentSubmitButton editing={Boolean(treatment)} />
      </div>
    </form>
  );
}
