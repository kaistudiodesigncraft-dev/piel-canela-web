import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicSiteContentSection } from "@/components/content/PublicSiteContentSection";
import { CatalogExperience } from "@/components/treatments/CatalogExperience";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";
import { getSiteContent } from "@/lib/supabase/site-content";

export const metadata: Metadata = {
  title: "Tratamientos",
  description:
    "Explorá tratamientos de estética, bienestar y recuperación con precio, duración e información clara.",
  alternates: { canonical: "/tratamientos" },
};

export default async function TreatmentsPage() {
  const [{
    categories: treatmentCategories,
    treatments,
    monthlySpecials,
  }, siteFields] = await Promise.all([getPublicCatalogSnapshot(), getSiteContent()]);
  return (
    <>
      <PublicSiteContentSection section="catalog_header" fields={siteFields} />
      <section className="section section--catalog" id="catalogo" aria-label="Catálogo de tratamientos">
        <div className="site-container">
          <Suspense fallback={<div className="catalog-skeleton" role="status" aria-label="Cargando catálogo" />}>
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
