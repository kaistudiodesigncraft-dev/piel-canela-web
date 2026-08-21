import { ArrowRight, Check, Clock3 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import { formatDuration, formatPrice } from "@/lib/format";
import { buildBookingHref } from "@/lib/treatments";

interface TreatmentDetailContentProps {
  treatment: Treatment;
  category: TreatmentCategory;
  monthlySpecial?: MonthlySpecial;
  compact?: boolean;
  preview?: boolean;
}

export function TreatmentDetailContent({
  treatment,
  category,
  monthlySpecial,
  compact = false,
  preview = false,
}: TreatmentDetailContentProps) {
  const price = monthlySpecial?.specialPriceCents ?? treatment.priceCents;

  return (
    <article className={`treatment-detail${compact ? " treatment-detail--compact" : ""}`}>
      <div className="treatment-detail__hero">
        <div className="treatment-detail__image">
          <Image
            src={monthlySpecial?.image.src ?? treatment.image.src}
            alt={monthlySpecial?.image.alt ?? treatment.image.alt}
            fill
            priority={!compact}
            sizes={compact ? "(max-width: 767px) 100vw, 560px" : "(max-width: 767px) 100vw, 48vw"}
            style={{ objectPosition: monthlySpecial?.image.focalPoint ?? treatment.image.focalPoint }}
          />
        </div>
        <div className="treatment-detail__intro">
          <p className="eyebrow">{monthlySpecial ? "Especial del mes" : category.name}</p>
          <h1>{monthlySpecial?.title ?? treatment.name}</h1>
          <p className="treatment-detail__lead">
            {monthlySpecial?.shortDescription ?? treatment.shortDescription}
          </p>
          {monthlySpecial ? <p>{monthlySpecial.detail}</p> : null}
          <ul className="feature-list">
            {treatment.characteristics.slice(0, 3).map((characteristic) => (
              <li key={characteristic}>
                <Check aria-hidden="true" strokeWidth={1.75} />
                {characteristic}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="treatment-detail__body">
        <section aria-labelledby={`about-${treatment.id}`}>
          <h2 id={`about-${treatment.id}`}>Qué podés esperar</h2>
          <p>{treatment.description}</p>
          {treatment.expectations.length > 0 ? (
            <ul className="detail-list">
              {treatment.expectations.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </section>

        <div className="treatment-detail__facts">
          {treatment.preparation ? (
            <section>
              <h2>Antes de venir</h2>
              <p>{treatment.preparation}</p>
            </section>
          ) : null}
          {treatment.contraindications ? (
            <section>
              <h2>Cuándo consultar antes</h2>
              <p>{treatment.contraindications}</p>
            </section>
          ) : null}
          {treatment.professional ? (
            <section>
              <h2>Atención</h2>
              <p>{treatment.professional}</p>
            </section>
          ) : null}
        </div>
      </div>

      <footer className="treatment-detail__booking numeric">
        <div>
          <span><Clock3 aria-hidden="true" strokeWidth={1.75} />Duración</span>
          <strong>{formatDuration(treatment.durationMinutes)}</strong>
        </div>
        <div>
          <span>{monthlySpecial ? "Valor especial" : "Valor"}</span>
          <strong>{formatPrice(price)}</strong>
          {monthlySpecial ? <del>{formatPrice(treatment.priceCents)}</del> : null}
        </div>
        {preview ? (
          <Link className="button button--light" href={`/admin/catalogo#treatment-${treatment.id}`}>
            Volver a edición
            <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </Link>
        ) : (
          <Link
            className="button button--light"
            href={buildBookingHref({
              treatmentId: treatment.id,
              monthlySpecialId: monthlySpecial?.id,
            })}
          >
            Iniciar reserva
            <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </Link>
        )}
      </footer>
    </article>
  );
}
