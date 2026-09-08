import { ArrowRight, Clock3, Layers3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import { formatDuration, formatPrice } from "@/lib/format";
import { buildCatalogHref } from "@/lib/treatments";

export interface ResolvedMonthlySpecial {
  special: MonthlySpecial;
  treatment: Treatment;
  category: TreatmentCategory;
}

interface MonthlySpecialGridProps {
  items: readonly ResolvedMonthlySpecial[];
}

export function MonthlySpecialGrid({ items }: MonthlySpecialGridProps) {
  return (
    <div className="monthly-special-grid">
      {items.map(({ special, treatment, category }) => {
        const usesClosedCombos = treatment.selectionMode === "closed_combo";
        return <article className="monthly-special-item" key={special.id}>
          <div className="monthly-special-item__image">
            <Image
              src={special.image.src}
              alt={special.image.alt}
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw"
              style={{ objectPosition: special.image.focalPoint }}
            />
          </div>
          <div className="monthly-special-item__content">
            <p className="eyebrow">{category.name}</p>
            <h3>{special.title}</h3>
            <p>{special.shortDescription}</p>
            <div className="monthly-special-item__meta numeric">
              {usesClosedCombos ? <span><Layers3 aria-hidden="true" strokeWidth={1.75} />{treatment.combos.length} {treatment.combos.length === 1 ? "combo" : "combos"}</span> : <><span><Clock3 aria-hidden="true" strokeWidth={1.75} />{formatDuration(treatment.durationMinutes)}</span><strong>{formatPrice(special.specialPriceCents)}</strong></>}
            </div>
            <Link
              className="text-link"
              href={buildCatalogHref(category.slug, treatment.slug, usesClosedCombos ? undefined : special.id)}
            >
              {usesClosedCombos ? "Ver combos" : "Ver especial"}
              <ArrowRight aria-hidden="true" strokeWidth={1.75} />
            </Link>
          </div>
        </article>;
      })}
    </div>
  );
}
