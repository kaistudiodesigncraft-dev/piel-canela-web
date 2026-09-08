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

interface MonthlySpecialFeatureProps {
  special: MonthlySpecial;
  treatment: Treatment;
  category: TreatmentCategory;
}

export function MonthlySpecialFeature({
  special,
  treatment,
  category,
}: MonthlySpecialFeatureProps) {
  const usesClosedCombos = treatment.selectionMode === "closed_combo";
  return (
    <article className="monthly-special-feature">
      <div className="monthly-special-feature__image">
        <Image
          src={special.image.src}
          alt={special.image.alt}
          fill
          sizes="(max-width: 767px) 100vw, 52vw"
          style={{ objectPosition: special.image.focalPoint }}
        />
      </div>
      <div className="monthly-special-feature__content">
        <p className="eyebrow">{category.name}</p>
        <h3>{special.title}</h3>
        <p>{special.detail}</p>
        <div className="monthly-special-feature__meta numeric">
          {usesClosedCombos ? <span><Layers3 aria-hidden="true" strokeWidth={1.75} />{treatment.combos.length} {treatment.combos.length === 1 ? "combo disponible" : "combos disponibles"}</span> : <><span><Clock3 aria-hidden="true" strokeWidth={1.75} />{formatDuration(treatment.durationMinutes)}</span><span>{formatPrice(special.specialPriceCents)}</span></>}
        </div>
        <Link
          className="button button--primary"
          href={buildCatalogHref(category.slug, treatment.slug, usesClosedCombos ? undefined : special.id)}
        >
          {usesClosedCombos ? "Ver combos" : "Ver especial"}
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
