import { ArrowRight, Clock3, ImageIcon, Layers3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Treatment, TreatmentCategory } from "@/domain/treatment";
import { quoteCombo } from "@/lib/combo-quote";
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
  const activeCombos = treatment.combos.filter((combo) => combo.isActive);
  const comboPrice = activeCombos.length > 0 ? Math.min(...activeCombos.map((combo) => quoteCombo(combo).priceCents)) : null;
  return (
    <article className={`treatment-editorial-card${treatment.image ? "" : " treatment-editorial-card--text"}`}>
      <div className="treatment-editorial-card__top">
        <div className="treatment-editorial-card__image">
          {treatment.image ? (
            <Image
              src={treatment.image.src}
              alt={treatment.image.alt}
              fill
              sizes="(max-width: 767px) 92vw, (max-width: 1100px) 48vw, 30vw"
              style={{ objectPosition: treatment.image.focalPoint }}
            />
          ) : (
            <span className="treatment-image-placeholder">
              <ImageIcon aria-hidden="true" strokeWidth={1.75} />
              Imagen en preparación
            </span>
          )}
        </div>
        <div className="treatment-editorial-card__content">
          <p className="eyebrow">{category.name}</p>
          <h3>{treatment.name}</h3>
          <p className="treatment-editorial-card__description">{treatment.shortDescription}</p>
        </div>
      </div>
      <div className="treatment-editorial-card__footer numeric">
        <span className="treatment-editorial-card__duration">
          {treatment.selectionMode !== "simple" ? <Layers3 aria-hidden="true" strokeWidth={1.75} /> : <Clock3 aria-hidden="true" strokeWidth={1.75} />}
          {treatment.selectionMode !== "simple" ? `${activeCombos.length} ${activeCombos.length === 1 ? "combo" : "combos"}` : formatDuration(treatment.durationMinutes)}
        </span>
        <strong>{treatment.selectionMode !== "simple" ? (comboPrice === null ? "En preparación" : `Desde ${formatPrice(comboPrice)}`) : formatPrice(treatment.priceCents)}</strong>
        <Link
          className="treatment-editorial-card__arrow"
          href={detailHref}
          scroll={false}
          data-treatment-opener={treatment.slug}
          aria-label={`Ver detalles de ${treatment.name}`}
          onClick={(event) => onOpen(event.currentTarget)}
        >
          <span>Ver detalle</span>
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
