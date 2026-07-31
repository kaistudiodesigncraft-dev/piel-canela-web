import { ArrowRight, Clock3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Treatment, TreatmentCategory } from "@/domain/treatment";
import { formatDuration, formatPrice } from "@/lib/format";

interface TreatmentEditorialCardProps {
  treatment: Treatment;
  category: TreatmentCategory;
  detailHref: string;
  onOpen: (trigger: HTMLAnchorElement) => void;
}

export function TreatmentEditorialCard({
  treatment,
  category,
  detailHref,
  onOpen,
}: TreatmentEditorialCardProps) {
  return (
    <article className="treatment-editorial-card">
      <div className="treatment-editorial-card__top">
        <div className="treatment-editorial-card__image">
          <Image
            src={treatment.image.src}
            alt={treatment.image.alt}
            fill
            sizes="(max-width: 767px) 92vw, (max-width: 1100px) 48vw, 30vw"
            style={{ objectPosition: treatment.image.focalPoint }}
          />
        </div>
        <div className="treatment-editorial-card__content">
          <p className="eyebrow">{category.name}</p>
          <h2>{treatment.name}</h2>
          <p className="treatment-editorial-card__description">{treatment.shortDescription}</p>
          <ul className="feature-list feature-list--compact">
            {treatment.characteristics.slice(0, 3).map((characteristic) => (
              <li key={characteristic}>{characteristic}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="treatment-editorial-card__footer numeric">
        <span className="treatment-editorial-card__duration">
          <Clock3 aria-hidden="true" strokeWidth={1.75} />
          {formatDuration(treatment.durationMinutes)}
        </span>
        <strong>{formatPrice(treatment.priceCents)}</strong>
        <Link
          className="treatment-editorial-card__arrow"
          href={detailHref}
          scroll={false}
          data-treatment-opener={treatment.slug}
          aria-label={`Ver detalles de ${treatment.name}`}
          onClick={(event) => onOpen(event.currentTarget)}
        >
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
