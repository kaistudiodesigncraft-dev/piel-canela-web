import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogExperience } from "@/components/treatments/CatalogExperience";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";

export const metadata: Metadata = {
  title: "Tratamientos",
  description:
    "Explorá tratamientos de estética, bienestar y recuperación con precio, duración e información clara.",
  alternates: { canonical: "/tratamientos" },
};

export default async function TreatmentsPage() {
  const {
    categories: treatmentCategories,
    treatments,
    monthlySpecials,
  } = await getPublicCatalogSnapshot();
  return (
    <>
      <section className="page-hero page-hero--catalog">
        <div className="site-container page-hero__content">
          <p className="eyebrow">Catálogo Piel Canela</p>
          <h1>Encontrá el tratamiento adecuado.</h1>
          <p>
            Filtrá por categoría y abrí cada ficha para conocer qué incluye, cuánto dura y qué considerar antes de reservar.
          </p>
        </div>
      </section>
      <section className="section section--catalog" id="catalogo" aria-label="Catálogo de tratamientos">
        <div className="site-container">
          <Suspense fallback={<div className="catalog-skeleton" aria-label="Cargando catálogo" />}>
            <CatalogExperience
              categories={treatmentCategories}
              treatments={treatments}
              monthlySpecials={monthlySpecials}
            />
          </Suspense>
        </div>
      </section>
    </>
  );
}
