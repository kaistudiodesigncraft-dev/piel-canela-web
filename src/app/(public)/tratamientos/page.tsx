import type { Metadata } from "next";
import { Suspense } from "react";
import { EditableSectionMedia, editableSurfaceClassName } from "@/components/content/EditableSectionMedia";
import { CatalogExperience } from "@/components/treatments/CatalogExperience";
import { siteContentMap } from "@/domain/site-content";
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
  const content = siteContentMap(siteFields);
  const headerImage = content.get("catalog_header_image");
  return (
    <>
      <section className={editableSurfaceClassName("page-hero page-hero--catalog", headerImage)}>
        <EditableSectionMedia field={headerImage} priority />
        <div className="site-container page-hero__content">
          <p className="eyebrow">{content.get("catalog_header_eyebrow")?.value}</p>
          <h1>{content.get("catalog_header_title")?.value}</h1>
          <p>
            {content.get("catalog_header_lead")?.value}
          </p>
        </div>
      </section>
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
