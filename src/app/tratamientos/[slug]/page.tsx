import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TreatmentPageClient } from "@/components/treatments/TreatmentPageClient";
import { StatePanel } from "@/components/ui/StatePanel";
import { treatments as fixtureTreatments } from "@/data/fixtures";
import { getTreatmentBySlug } from "@/lib/treatments";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";

interface TreatmentPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return fixtureTreatments.map((treatment) => ({ slug: treatment.slug }));
}

export async function generateMetadata({ params }: TreatmentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { treatments } = await getPublicCatalogSnapshot();
  const treatment = getTreatmentBySlug(treatments, slug);
  if (!treatment) return { title: "Tratamiento no encontrado" };
  return {
    title: treatment.name,
    description: treatment.shortDescription,
  };
}

export default async function TreatmentPage({ params }: TreatmentPageProps) {
  const { slug } = await params;
  const {
    categories: treatmentCategories,
    treatments,
    monthlySpecials,
  } = await getPublicCatalogSnapshot();
  const treatment = getTreatmentBySlug(treatments, slug);
  if (!treatment) notFound();

  if (!treatment.isActive) {
    return (
      <div className="site-container route-state">
        <StatePanel
          kind="unavailable"
          title="Este tratamiento no está disponible"
          description="Puede estar en revisión o fuera de agenda. Consultá otras opciones publicadas."
          actionHref="/tratamientos"
          actionLabel="Ver tratamientos"
        />
      </div>
    );
  }

  const category = treatmentCategories.find((item) => item.id === treatment.categoryId);
  if (!category) notFound();

  return (
    <div className="treatment-page">
      <div className="site-container treatment-page__back">
        <Link className="text-link" href={`/tratamientos?category=${category.slug}#catalogo`}>
          Volver a {category.name}
        </Link>
      </div>
      <div className="site-container treatment-page__content">
        <Suspense fallback={<div className="catalog-skeleton" aria-label="Cargando tratamiento" />}>
          <TreatmentPageClient
            treatment={treatment}
            category={category}
            monthlySpecials={monthlySpecials}
          />
        </Suspense>
      </div>
    </div>
  );
}
