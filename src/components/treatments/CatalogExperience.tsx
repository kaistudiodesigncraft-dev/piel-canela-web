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
import { sortCatalogItems, type CatalogGroup } from "@/lib/catalog-order";
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
  const searchQuery = searchParams.get("q")?.trim() ?? "";
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
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
    const active = treatments.filter((treatment) => treatment.isActive && normalize(treatment.name).includes(normalize(searchQuery)));
    const filtered = selectedCategory ? active.filter((treatment) => treatment.categoryId === selectedCategory.id) : active;
    const categoryOrder = new Map(categories.map((category) => [category.id, category.displayOrder]));
    return sortCatalogItems(filtered, (treatment) => ({
      categoryOrder: categoryOrder.get(treatment.categoryId) ?? 999,
      catalogGroup: treatment.catalogGroup ?? "default",
      isCombo: treatment.isCombo ?? false,
      displayOrder: treatment.displayOrder,
    }));
  }, [categories, selectedCategory, treatments, searchQuery]);

  const groupLabel = (treatment: Treatment) => {
    if (treatment.isCombo) return "Combos";
    const labels: Record<CatalogGroup, string | null> = {
      default: null,
      facial: "Tratamientos faciales",
      brows_lashes: "Cejas y pestañas",
      depilation: "Depilación",
    };
    return labels[treatment.catalogGroup ?? "default"];
  };

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
    router.replace(withCurrentParams({ treatment: null, monthlySpecial: null, comboId: null, zoneId: null, zoneOrder: null, extraId: null }), {
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
      <div className="catalog-tools">
      <form role="search" className="catalog-search" action={pathname} onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        router.replace(withCurrentParams({ q: String(data.get("q") ?? "").trim(), treatment: null, monthlySpecial: null }), { scroll: false });
      }}>
        <label htmlFor="treatment-search">Buscar un tratamiento</label>
        <div><input key={searchQuery} id="treatment-search" name="q" type="search" maxLength={100} defaultValue={searchQuery} placeholder="Nombre del tratamiento" />
        <button className="button button--primary" type="submit">Buscar</button></div>
      </form>
      <div className="catalog-filters" aria-label="Filtrar tratamientos por categoría">
        <Link
          className={`filter-chip${selectedCategory ? "" : " is-active"}`}
          href={withCurrentParams({ category: null, treatment: null, monthlySpecial: null })}
          scroll={false}
          aria-current={selectedCategory ? undefined : "page"}
        >
          Todos
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            className={`filter-chip${selectedCategory?.id === category.id ? " is-active" : ""}`}
            href={withCurrentParams({ category: category.slug, treatment: null, monthlySpecial: null })}
            scroll={false}
            aria-current={selectedCategory?.id === category.id ? "page" : undefined}
          >
            {category.name}
          </Link>
        ))}
      </div>
      </div>

      <div className="catalog-summary">
        <h2 ref={catalogHeadingRef} tabIndex={-1}>
          {selectedCategory ? selectedCategory.name : "Todos los tratamientos"}
        </h2>
        <div className="catalog-summary__meta"><p aria-live="polite">
          {visibleTreatments.length} {visibleTreatments.length === 1 ? "tratamiento" : "tratamientos"}
        </p>
        {selectedCategory || searchQuery ? (
          <Link className="text-link" href="/tratamientos#catalogo" scroll={false}>
            <RotateCcw aria-hidden="true" strokeWidth={1.75} />Limpiar filtro
          </Link>
        ) : null}</div>
      </div>

      {visibleTreatments.length === 0 ? (
        <StatePanel
          kind="empty"
          title="No encontramos tratamientos con esos filtros"
          description="Probá otro nombre, cambiá la categoría o volvé a ver el catálogo completo."
          actionHref="/tratamientos#catalogo"
          actionLabel="Ver todos"
        />
      ) : (
        <div className="treatment-editorial-grid">
          {visibleTreatments.map((treatment, index) => {
            const category = categories.find((item) => item.id === treatment.categoryId);
            if (!category) return null;
            const currentGroup = selectedCategory?.slug === "estetica" ? groupLabel(treatment) : null;
            const previousGroup = index > 0 ? groupLabel(visibleTreatments[index - 1]!) : null;
            return (
              <div className="catalog-group-item" key={treatment.id}>
                {currentGroup && currentGroup !== previousGroup ? <h3 className="catalog-group-heading">{currentGroup}</h3> : null}
                <TreatmentEditorialCard
                  treatment={treatment}
                  category={category}
                  detailHref={withCurrentParams({ treatment: treatment.slug, monthlySpecial: null, comboId: null, zoneId: null, zoneOrder: null, extraId: null })}
                  onOpen={rememberOpener}
                />
              </div>
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

    </div>
  );
}
