import { ArrowRight, Check, Clock3, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import { formatDuration, formatPrice } from "@/lib/format";
import { buildBookingHref, buildConfiguredBookingHref } from "@/lib/treatments";
import { ConfigurableBookingSelector } from "./ConfigurableBookingSelector";
import { TreatmentComboSelector } from "./TreatmentComboSelector";

interface TreatmentDetailContentProps {
  treatment: Treatment;
  category: TreatmentCategory;
  monthlySpecial?: MonthlySpecial;
  compact?: boolean;
  preview?: boolean;
  bookableComboIds?: readonly string[];
}

export function TreatmentDetailContent({
  treatment,
  category,
  monthlySpecial,
  compact = false,
  preview = false,
  bookableComboIds,
}: TreatmentDetailContentProps) {
  const configured = treatment.configEnabled === true ? treatment.bookingConfig : undefined;
  const configuredNeedsSelection = Boolean(configured && configured.mode !== "simple");
  const legacyNeedsSelection = !configured && treatment.selectionMode !== "simple";
  const activeSpecial = !configured && treatment.selectionMode === "simple" ? monthlySpecial : undefined;
  const configuredPrice = configured?.priceRule.type === "fixed" ? configured.priceRule.priceCents : treatment.priceCents;
  const configuredDuration = configured?.durationRule.type === "fixed" || configured?.durationRule.type === "per_session"
    ? configured.durationRule.durationMinutes
    : treatment.durationMinutes;
  const price = activeSpecial?.specialPriceCents ?? configuredPrice;
  const image = activeSpecial?.image ?? treatment.image;

  return (
    <article className={`treatment-detail${compact ? " treatment-detail--compact" : ""}`}>
      <div className="treatment-detail__hero">
        <div className="treatment-detail__intro">
          <p className="eyebrow">{activeSpecial ? "Especial del mes" : category.name}</p>
          <h1>{activeSpecial?.title ?? treatment.name}</h1>
          {configuredNeedsSelection ? <p>Elegí las opciones disponibles para conocer duración y precio.</p> : null}
          {legacyNeedsSelection ? <p>{treatment.zoneOrder ? "Elegí zonas sueltas o un combo para conocer duración y precio." : "Elegí un combo para conocer duración y precio."}</p> : null}
          <p className="treatment-detail__lead">
            {activeSpecial?.shortDescription ?? treatment.shortDescription}
          </p>
          {activeSpecial ? <p>{activeSpecial.detail}</p> : null}
        </div>
        <div className={`treatment-detail__image${image ? "" : " treatment-detail__image--empty"}`}>
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
      {!configuredNeedsSelection && !legacyNeedsSelection ? <div className="treatment-detail__booking numeric">
        <div>
          <span><Clock3 aria-hidden="true" strokeWidth={1.75} />Duración</span>
          <strong>{formatDuration(configuredDuration)}</strong>
        </div>
        <div>
          <span>{activeSpecial ? "Valor especial" : "Valor"}</span>
          <strong>{formatPrice(price)}</strong>
          {activeSpecial ? <del>{formatPrice(treatment.priceCents)}</del> : null}
        </div>
        {preview ? (
          <Link className="button button--light" href={`/admin/catalogo#treatment-${treatment.id}`}>
            Volver a edición<ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </Link>
        ) : (
          <Link className="button button--light" href={configured
            ? buildConfiguredBookingHref({ treatmentId: treatment.id, combinationId: null, optionIds: [] })
            : buildBookingHref({ treatmentId: treatment.id, monthlySpecialId: activeSpecial?.id })}>
            Iniciar reserva<ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </Link>
        )}
      </div> : null}
      </div>

      <div className="treatment-detail__body">
        <section aria-labelledby={`about-${treatment.id}`}>
          <h2 id={`about-${treatment.id}`}>Qué podés esperar</h2>
          <p>{treatment.description}</p>
          {treatment.characteristics.length > 0 ? <ul className="feature-list">
            {treatment.characteristics.slice(0, 3).map((characteristic) => (
              <li key={characteristic}><Check aria-hidden="true" strokeWidth={1.75} />{characteristic}</li>
            ))}
          </ul> : null}
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

      {configuredNeedsSelection ? <ConfigurableBookingSelector treatment={treatment} preview={preview} /> : null}
      {!configured && treatment.selectionMode !== "simple" ? (
        treatment.zoneOrder || treatment.combos.length > 0 ? <TreatmentComboSelector treatment={treatment} preview={preview} bookableComboIds={bookableComboIds} /> : <section className="combo-selector combo-selector--empty"><h2>No hay combos disponibles para reservar</h2><p>En este momento no hay opciones publicadas disponibles. Podés volver al catálogo para elegir otro tratamiento.</p><Link className="button button--quiet" href="/tratamientos">Ver tratamientos</Link></section>
      ) : null}
    </article>
  );
}
