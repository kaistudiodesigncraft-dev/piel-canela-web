"use client";

import { ChevronDown, Eye, ImageIcon, Plus, Search } from "lucide-react";
import { FlowerLotus, PersonArmsSpread, UserFocus } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { saveTreatment, updateTreatmentCategory } from "@/app/admin/catalogo/actions";
import {
  focalPointToPercentage,
  getTreatmentPublicationState,
  linesToAdminText,
} from "@/lib/admin/catalog";
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
    upload: "La imagen no pudo cargarse.",
    taxonomy: "La categoría o especialidad seleccionada no está disponible.",
  };
  return <p className="form-message form-message--error" role="alert">{messages[error] ?? "No se pudieron guardar los cambios. Revisá los campos e intentá nuevamente."}</p>;
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
  const activeSpecialties = specialties.filter((item) => item.is_active || item.id === treatment?.specialty_id);
  const [selectedSpecialty, setSelectedSpecialty] = useState(treatment?.specialty_id ?? "");
  const [selectedProfessional, setSelectedProfessional] = useState(treatment?.professional_id ?? "");
  const [focalX, setFocalX] = useState(focalPointToPercentage(treatment?.image_focal_x ?? 0.5));
  const [focalY, setFocalY] = useState(focalPointToPercentage(treatment?.image_focal_y ?? 0.5));
  const availableProfessionals = professionals.filter((item) =>
    item.specialty_id === selectedSpecialty && (item.is_active || item.id === treatment?.professional_id),
  );
  return (
    <form action={saveTreatment} className="admin-form admin-form--treatment">
      {treatment ? <input type="hidden" name="treatmentId" value={treatment.id} /> : null}
      <fieldset><legend>Información pública</legend><div className="admin-form-grid admin-form-grid--3"><label>Nombre<input name="name" defaultValue={treatment?.name ?? ""} minLength={2} maxLength={120} required /></label><label>Categoría<select name="categoryId" defaultValue={treatment?.category_id ?? ""} required><option value="">Seleccionar</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Orden<input name="displayOrder" type="number" min="0" max="999" defaultValue={treatment?.display_order ?? 0} required /></label></div><label>Descripción breve<textarea name="shortDescription" defaultValue={treatment?.short_description ?? ""} rows={2} minLength={10} maxLength={240} required /></label><label>Detalle completo<textarea name="description" defaultValue={treatment?.description ?? ""} rows={4} minLength={20} maxLength={3000} required /></label><div className="admin-form-grid"><label>Características de la ficha<small>Hasta tres, una por línea.</small><textarea name="characteristics" defaultValue={linesToAdminText(treatment?.characteristics ?? [])} rows={4} /></label><label>Qué puede esperar la persona<small>Una idea por línea.</small><textarea name="expectations" defaultValue={linesToAdminText(treatment?.expectations ?? [])} rows={4} /></label></div><div className="admin-form-grid"><label>Preparación opcional<textarea name="preparation" defaultValue={treatment?.preparation ?? ""} rows={3} maxLength={1400} /></label><label>Cuándo consultar antes<textarea name="contraindications" defaultValue={treatment?.contraindications ?? ""} rows={3} maxLength={1400} /></label></div></fieldset>
      <fieldset><legend>Operación y precio</legend><div className="admin-form-grid admin-form-grid--3"><label>Especialidad<select name="specialtyId" value={selectedSpecialty} onChange={(event) => { setSelectedSpecialty(event.target.value); setSelectedProfessional(""); }} required><option value="">Seleccionar</option>{activeSpecialties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Profesional opcional<select name="professionalId" value={selectedProfessional} onChange={(event) => setSelectedProfessional(event.target.value)}><option value="">Sin asignación fija</option>{availableProfessionals.map((item) => <option key={item.id} value={item.id}>{item.public_name || item.full_name}</option>)}</select></label><label>Precio en pesos<input name="pricePesos" type="number" min="0" step="1" defaultValue={treatment ? treatment.price_cents / 100 : ""} required /></label></div><div className="admin-form-grid admin-form-grid--3"><label>Duración<input name="durationMinutes" type="number" min="5" max="480" step="5" defaultValue={treatment?.duration_minutes ?? 60} required /></label><label>Preparación entre turnos<input name="bufferMinutes" type="number" min="0" max="180" step="5" defaultValue={treatment?.buffer_minutes ?? 15} required /></label><label className="admin-check"><input type="checkbox" name="isActive" defaultChecked={treatment?.is_active ?? false} /><span>Publicar y habilitar reservas</span></label></div>{treatment && treatment.future_booking_count > 0 ? <label className="admin-impact-check"><input type="checkbox" name="confirmImpact" /><span><strong>{treatment.future_booking_count} reservas futuras.</strong> Confirmo el cambio de duración, buffer o publicación si afecta la agenda.</span></label> : null}</fieldset>
      <fieldset><legend>Imagen y encuadre</legend><div className="admin-form-grid"><label>Imagen {treatment ? "opcional para reemplazar" : ""}<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" /><small>JPG, PNG, WebP o AVIF. Máximo 8 MB.</small></label><label>Descripción accesible<input name="imageAlt" defaultValue={treatment?.image_alt ?? ""} minLength={3} maxLength={240} /></label></div><div className="admin-form-grid"><label>Foco horizontal: <output>{focalX}%</output><input name="focalX" type="range" min="0" max="100" value={focalX} onChange={(event) => setFocalX(Number(event.target.value))} /></label><label>Foco vertical: <output>{focalY}%</output><input name="focalY" type="range" min="0" max="100" value={focalY} onChange={(event) => setFocalY(Number(event.target.value))} /></label></div></fieldset>
      <div className="admin-form-footer"><p>El nombre crea una URL estable al guardar por primera vez. Editarlo después no rompe enlaces compartidos.</p><button className="button button--primary" type="submit">{treatment ? "Guardar tratamiento" : "Crear borrador"}</button></div>
    </form>
  );
}
