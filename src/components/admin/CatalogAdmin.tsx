"use client";

import { ArrowRight, ImageIcon, Plus, Search } from "lucide-react";
import { FlowerLotus, PersonArmsSpread, UserFocus } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { updateTreatmentCategory } from "@/app/admin/catalogo/actions";
import { focalPointToPercentage, getTreatmentPublicationState } from "@/lib/admin/catalog";
import type { AdminCategoryRow, AdminProfessionalRow, AdminSpecialtyRow, AdminTreatmentRow } from "@/lib/admin/treatment-editor-types";
import { formatDuration, formatPrice } from "@/lib/format";

export type { AdminCategoryRow, AdminProfessionalRow, AdminSpecialtyRow, AdminTreatmentRow } from "@/lib/admin/treatment-editor-types";

interface CatalogAdminProps {
  categories: AdminCategoryRow[];
  specialties: AdminSpecialtyRow[];
  professionals: AdminProfessionalRow[];
  treatments: AdminTreatmentRow[];
  feedback: Record<string, string | undefined>;
  bookingCountsAvailable?: boolean;
  bookingCountsIncidentId?: string;
}

const publicationLabels = { published: "Publicado", ready: "Listo para publicar", draft: "Borrador incompleto" } as const;

function CategoryIcon({ name }: { name: string }) {
  const Icon = name === "FlowerLotus" ? FlowerLotus : name === "PersonArmsSpread" ? PersonArmsSpread : UserFocus;
  return <Icon aria-hidden="true" weight="regular" />;
}

function Feedback({ success, error }: { success?: boolean; error?: string }) {
  if (success) return <p className="form-message" role="status">Los cambios quedaron guardados.</p>;
  if (!error) return null;
  return <p className="form-message form-message--error" role="alert">No pudimos guardar esta categoría. Revisá sus datos e intentá nuevamente.</p>;
}

export function CatalogAdmin({ categories, specialties, treatments, feedback, bookingCountsAvailable = true, bookingCountsIncidentId }: CatalogAdminProps) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<"all" | "published" | "ready" | "draft">("all");
  const categoryName = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const specialtyName = useMemo(() => new Map(specialties.map((item) => [item.id, item.name])), [specialties]);
  const filtered = treatments.filter((treatment) => {
    const state = getTreatmentPublicationState({ isActive: treatment.is_active, imagePath: treatment.image_path, imageAlt: treatment.image_alt, shortDescription: treatment.short_description, description: treatment.description, priceCents: treatment.price_cents });
    if (stateFilter !== "all" && state !== stateFilter) return false;
    return `${treatment.name} ${categoryName.get(treatment.category_id)} ${specialtyName.get(treatment.specialty_id)}`.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR"));
  });

  return (
    <>
      <section className="live-admin__section admin-catalog-section" id="tratamientos" aria-labelledby="catalog-title">
        <div className="admin-section-heading">
          <div><h2 id="catalog-title">Tratamientos</h2><p>Buscá una ficha para editarla o empezá un tratamiento nuevo como borrador.</p></div>
          <Link className="button button--primary" href="/admin/catalogo/nuevo"><Plus aria-hidden="true" strokeWidth={1.75} />Nuevo tratamiento</Link>
        </div>
        {!bookingCountsAvailable ? <div className="form-message form-message--warning" role="status"><strong>El catálogo está disponible, pero no pudimos calcular el impacto sobre reservas.</strong><span>Podés editar textos e imágenes. Evitá cambios de agenda hasta recuperar ese dato.</span>{bookingCountsIncidentId ? <small>Código de soporte: {bookingCountsIncidentId}</small> : null}</div> : null}
        <div className="admin-booking-toolbar">
          <label className="admin-search"><Search aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Buscar tratamientos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tratamiento, categoría o especialidad" /></label>
          <label><span className="sr-only">Filtrar publicación</span><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as typeof stateFilter)}><option value="all">Todos los estados</option><option value="published">Publicados</option><option value="ready">Listos para publicar</option><option value="draft">Borradores incompletos</option></select></label>
          <span className="admin-count numeric">{filtered.length} resultados</span>
        </div>
        {filtered.length === 0 ? <div className="admin-empty"><ImageIcon aria-hidden="true" strokeWidth={1.75} /><h3>No hay tratamientos para esta vista.</h3><p>Probá otro filtro o creá un nuevo borrador.</p><Link className="button button--primary" href="/admin/catalogo/nuevo">Nuevo tratamiento</Link></div> : <div className="admin-treatment-manager-list">{filtered.map((treatment) => {
          const state = getTreatmentPublicationState({ isActive: treatment.is_active, imagePath: treatment.image_path, imageAlt: treatment.image_alt, shortDescription: treatment.short_description, description: treatment.description, priceCents: treatment.price_cents });
          return <article key={treatment.id} className="admin-treatment-manager-item admin-treatment-manager-item--link"><Link className="admin-treatment-manager-item__summary" href={`/admin/catalogo/${treatment.id}`}><div className="admin-treatment-manager-item__image">{treatment.image_url ? <Image src={treatment.image_url} alt={treatment.image_alt ?? ""} fill sizes="96px" style={{ objectPosition: `${focalPointToPercentage(treatment.image_focal_x)}% ${focalPointToPercentage(treatment.image_focal_y)}%` }} /> : <ImageIcon aria-hidden="true" strokeWidth={1.75} />}</div><div><span className={`status-badge status-${state === "published" ? "confirmed" : state === "ready" ? "awaiting_deposit" : "expired"}`}>{publicationLabels[state]}</span><h3>{treatment.name}</h3><p>{categoryName.get(treatment.category_id)} · {specialtyName.get(treatment.specialty_id)}</p></div><div className="admin-treatment-manager-item__facts numeric"><span>{formatDuration(treatment.duration_minutes)} + {treatment.buffer_minutes} min</span><small>Inicios cada {treatment.start_interval_minutes} min</small><strong>{formatPrice(treatment.price_cents)}</strong>{bookingCountsAvailable && treatment.future_booking_count > 0 ? <small>{treatment.future_booking_count} reservas futuras</small> : null}</div><span className="admin-treatment-manager-item__edit">Editar <ArrowRight aria-hidden="true" strokeWidth={1.75} /></span></Link></article>;
        })}</div>}
      </section>
      <section className="live-admin__section" id="categorias" aria-labelledby="categories-title">
        <div className="admin-section-heading"><div><h2 id="categories-title">Categorías del catálogo</h2><p>Las tres entradas de la home son estructurales. Podés ajustar sus nombres y explicaciones.</p></div></div>
        <Feedback success={feedback.categorySaved === "1"} error={feedback.categoryError} />
        <div className="admin-category-editor-grid">{categories.map((category) => <form action={updateTreatmentCategory} className="admin-form" key={category.id}><input type="hidden" name="categoryId" value={category.id} /><div className="admin-category-editor-grid__identity"><CategoryIcon name={category.icon_name} /><small>URL estable: /tratamientos?categoria={category.slug}</small></div><label>Nombre<input name="name" defaultValue={category.name} minLength={2} maxLength={80} required /></label><label>Explicación breve<textarea name="shortDescription" defaultValue={category.short_description} rows={3} minLength={10} maxLength={240} required /></label><button className="button button--primary" type="submit">Guardar categoría</button></form>)}</div>
      </section>
    </>
  );
}
