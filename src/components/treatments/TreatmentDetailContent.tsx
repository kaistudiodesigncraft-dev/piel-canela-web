import { ArrowRight, Check, Clock3, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import { formatDuration, formatPrice } from "@/lib/format";
import { buildBookingHref } from "@/lib/treatments";
import { TreatmentComboSelector } from "./TreatmentComboSelector";

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
  const activeSpecial = treatment.selectionMode === "simple" ? monthlySpecial : undefined;
  const price = activeSpecial?.specialPriceCents ?? treatment.priceCents;
  const image = activeSpecial?.image ?? treatment.image;

  return (
    <article className={`treatment-detail${compact ? " treatment-detail--compact" : ""}`}>
      <div className="treatment-detail__hero">
        <div className="treatment-detail__image">
          {image ? (
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={!compact}
              sizes={compact ? "(max-width: 767px) 100vw, 560px" : "(max-width: 767px) 100vw, 48vw"}
              style={{ objectPosition: image.focalPoint }}
            />
          ) : (
            <span className="treatment-image-placeholder treatment-image-placeholder--detail">
              <ImageIcon aria-hidden="true" strokeWidth={1.75} />
              Imagen en preparación
            </span>
          )}
        </div>
        <div className="treatment-detail__intro">
          <p className="eyebrow">{activeSpecial ? "Especial del mes" : category.name}</p>
          <h1>{activeSpecial?.title ?? treatment.name}</h1>
          <p className="treatment-detail__lead">
            {activeSpecial?.shortDescription ?? treatment.shortDescription}
          </p>
          {activeSpecial ? <p>{activeSpecial.detail}</p> : null}
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

      {treatment.selectionMode === "closed_combo" ? (
        treatment.combos.length > 0 ? <TreatmentComboSelector treatment={treatment} /> : <section className="combo-selector combo-selector--empty"><h2>Combos en preparación</h2><p>Piel Canela está terminando de configurar las opciones disponibles. Volvé a consultar pronto.</p></section>
      ) : <footer className="treatment-detail__booking numeric">
        <div>
          <span><Clock3 aria-hidden="true" strokeWidth={1.75} />Duración</span>
          <strong>{formatDuration(treatment.durationMinutes)}</strong>
        </div>
        <div>
          <span>{activeSpecial ? "Valor especial" : "Valor"}</span>
          <strong>{formatPrice(price)}</strong>
          {activeSpecial ? <del>{formatPrice(treatment.priceCents)}</del> : null}
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
              monthlySpecialId: activeSpecial?.id,
            })}
          >
            Iniciar reserva
            <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </Link>
        )}
      </footer>}
    </article>
  );
}
