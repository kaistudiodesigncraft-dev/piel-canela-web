"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import { getMonthlySpecialForTreatment } from "@/lib/treatments";
import { StatePanel } from "@/components/ui/StatePanel";
import { TreatmentDetailDialog } from "./TreatmentDetailDialog";
import { TreatmentEditorialCard } from "./TreatmentEditorialCard";

interface CatalogExperienceProps {
  categories: readonly TreatmentCategory[];
  treatments: readonly Treatment[];
  monthlySpecials: readonly MonthlySpecial[];
}

export function CatalogExperience({
  categories,
  treatments,
  monthlySpecials,
}: CatalogExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openerRef = useRef<HTMLAnchorElement | null>(null);
  const catalogHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const categorySlug = searchParams.get("category");
  const selectedCategory = categories.find((category) => category.slug === categorySlug);
  const selectedTreatmentSlug = searchParams.get("treatment");
  const selectedTreatment = treatments.find(
    (treatment) => treatment.slug === selectedTreatmentSlug,
  );
  const selectedTreatmentCategory = categories.find(
    (category) => category.id === selectedTreatment?.categoryId,
  );
  const selectedMonthlySpecial = selectedTreatment
    ? getMonthlySpecialForTreatment(
        monthlySpecials,
        searchParams.get("monthlySpecial"),
        selectedTreatment.id,
      )
    : undefined;

  const visibleTreatments = useMemo(() => {
    const active = treatments.filter((treatment) => treatment.isActive);
    if (!selectedCategory) return active;
    return active.filter((treatment) => treatment.categoryId === selectedCategory.id);
  }, [selectedCategory, treatments]);

  function withCurrentParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }

  function rememberOpener(trigger: HTMLAnchorElement) {
    openerRef.current = trigger;
  }

  function closeTreatment() {
    const treatmentSlugToRestore = selectedTreatmentSlug;
    router.replace(withCurrentParams({ treatment: null, monthlySpecial: null }), {
      scroll: false,
    });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const matchingOpener = Array.from(
          document.querySelectorAll<HTMLAnchorElement>("[data-treatment-opener]"),
        ).find((element) => element.dataset.treatmentOpener === treatmentSlugToRestore);
        const target =
          (openerRef.current?.isConnected ? openerRef.current : matchingOpener) ??
          catalogHeadingRef.current;
        target?.focus({ preventScroll: true });
      });
    });
  }

  return (
    <div className="catalog-experience">
      <div className="catalog-filters" aria-label="Filtrar tratamientos por categoría">
        <Link
          className={`filter-chip${selectedCategory ? "" : " is-active"}`}
          href="/tratamientos#catalogo"
          scroll={false}
          aria-current={selectedCategory ? undefined : "page"}
        >
          Todos
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            className={`filter-chip${selectedCategory?.id === category.id ? " is-active" : ""}`}
            href={`/tratamientos?category=${category.slug}#catalogo`}
            scroll={false}
            aria-current={selectedCategory?.id === category.id ? "page" : undefined}
          >
            {category.name}
          </Link>
        ))}
      </div>

      <div className="catalog-summary">
        <h2 ref={catalogHeadingRef} tabIndex={-1}>
          {selectedCategory ? selectedCategory.name : "Todos los tratamientos"}
        </h2>
        <p aria-live="polite">
          {visibleTreatments.length} {visibleTreatments.length === 1 ? "tratamiento" : "tratamientos"}
        </p>
      </div>

      {visibleTreatments.length === 0 ? (
        <StatePanel
          kind="empty"
          title="No hay tratamientos publicados en esta categoría"
          description="Probá con otra categoría o volvé a ver el catálogo completo."
          actionHref="/tratamientos#catalogo"
          actionLabel="Ver todos"
        />
      ) : (
        <div className="treatment-editorial-grid">
          {visibleTreatments.map((treatment) => {
            const category = categories.find((item) => item.id === treatment.categoryId);
            if (!category) return null;
            return (
              <TreatmentEditorialCard
                key={treatment.id}
                treatment={treatment}
                category={category}
                detailHref={withCurrentParams({
                  treatment: treatment.slug,
                  monthlySpecial: null,
                })}
                onOpen={rememberOpener}
              />
            );
          })}
        </div>
      )}

      {selectedTreatment && selectedTreatmentCategory ? (
        <TreatmentDetailDialog
          key={`${selectedTreatment.id}-${selectedMonthlySpecial?.id ?? "regular"}`}
          treatment={selectedTreatment}
          category={selectedTreatmentCategory}
          monthlySpecial={selectedMonthlySpecial}
          onClose={closeTreatment}
        />
      ) : selectedTreatmentSlug ? (
        <StatePanel
          kind="error"
          title="No pudimos abrir ese tratamiento"
          description="El enlace puede estar desactualizado o el tratamiento ya no está publicado."
          actionHref="/tratamientos#catalogo"
          actionLabel="Volver al catálogo"
        />
      ) : null}

      {selectedCategory ? (
        <Link className="catalog-reset text-link" href="/tratamientos#catalogo" scroll={false}>
          <RotateCcw aria-hidden="true" strokeWidth={1.75} />
          Limpiar filtro
        </Link>
      ) : null}
    </div>
  );
}
