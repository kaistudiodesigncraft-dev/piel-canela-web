import { ArrowRight, Check, MessageCircleMore } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CategoryEntryCard } from "@/components/treatments/CategoryEntryCard";
import { MonthlySpecialsSection } from "@/components/specials/MonthlySpecialsSection";
import { getPublicMonthlySpecials } from "@/lib/treatments";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";

export const revalidate = 3600;

export default async function HomePage() {
  const {
    categories: treatmentCategories,
    treatments,
    monthlySpecials,
  } = await getPublicCatalogSnapshot();
  const publicSpecials = getPublicMonthlySpecials(monthlySpecials);

  return (
    <>
      <section className="home-hero">
        <div className="site-container home-hero__grid">
          <div className="home-hero__content">
            <p className="eyebrow">Bienestar, estética y recuperación</p>
            <h1>Cuidado profesional para cada momento.</h1>
            <p className="home-hero__lead">
              Conocé cada tratamiento, entendé qué podés esperar y elegí el momento que mejor se adapte a vos.
            </p>
            <div className="button-row">
              <Link className="button button--primary" href="/tratamientos">
                Explorar tratamientos
                <ArrowRight aria-hidden="true" strokeWidth={1.75} />
              </Link>
              <Link className="button button--quiet" href="/#contacto">
                <MessageCircleMore aria-hidden="true" strokeWidth={1.75} />
                Consultar
              </Link>
            </div>
            <ul className="hero-assurances" aria-label="Información importante">
              <li><Check aria-hidden="true" strokeWidth={1.75} />Precios y duración visibles</li>
              <li><Check aria-hidden="true" strokeWidth={1.75} />Pre-reserva sin crear una cuenta</li>
            </ul>
          </div>
          <div className="home-hero__visual" aria-label="Imagen conceptual de muestra">
            <div className="home-hero__image-frame">
              <Image
                src="/images/treatment-massage-concept.png"
                alt="Fotografía conceptual de muestra de un tratamiento corporal"
                fill
                priority
                sizes="(max-width: 767px) 92vw, 48vw"
                style={{ objectPosition: "38% 50%" }}
              />
            </div>
            <p className="home-hero__caption">Un recorrido simple desde la elección hasta la pre-reserva.</p>
          </div>
        </div>
      </section>

      <section className="section section--categories" aria-labelledby="categories-title">
        <div className="site-container">
          <div className="section-heading section-heading--centered">
            <p className="eyebrow">Encontrá tu recorrido</p>
            <h2 id="categories-title">Nuestros tratamientos</h2>
            <p>Elegí el camino que mejor se adapta a lo que necesitás hoy.</p>
          </div>
          <div className="category-entry-grid">
            {treatmentCategories.map((category) => (
              <CategoryEntryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      <MonthlySpecialsSection
        specials={publicSpecials}
        treatments={treatments}
        categories={treatmentCategories}
      />

      <section className="section section--approach" id="piel-canela" aria-labelledby="approach-title">
        <div className="site-container approach-grid">
          <div className="approach-grid__intro">
            <p className="eyebrow">Una elección informada</p>
            <h2 id="approach-title">Cuidado cercano, información concreta.</h2>
          </div>
          <div className="approach-grid__copy">
            <p>
              Piel Canela reúne propuestas de bienestar, estética y recuperación dentro del entorno de Espacio O2. La web organiza esa variedad para que puedas entender cada opción antes de consultar.
            </p>
            <p>
              Cuando un tratamiento necesita una evaluación previa, lo indicamos con claridad. La reserva queda pendiente hasta confirmar la seña por WhatsApp.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--steps" aria-labelledby="steps-title">
        <div className="site-container">
          <div className="section-heading">
            <p className="eyebrow">Reservar es simple</p>
            <h2 id="steps-title">Elegí con claridad y confirmá por WhatsApp.</h2>
          </div>
          <ol className="booking-steps">
            <li><span>Elegí</span><p>Explorá categorías y abrí el detalle completo.</p></li>
            <li><span>Seleccioná</span><p>Indicá el tratamiento que querés reservar.</p></li>
            <li><span>Completá</span><p>La fecha y el horario se incorporarán en la próxima fase.</p></li>
            <li><span>Confirmá</span><p>La seña y la confirmación final se coordinan por WhatsApp.</p></li>
          </ol>
        </div>
      </section>

      <section className="section section--faq" aria-labelledby="faq-title">
        <div className="site-container faq-grid">
          <div className="section-heading">
            <p className="eyebrow">Antes de reservar</p>
            <h2 id="faq-title">Preguntas frecuentes</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>¿La pre-reserva confirma mi turno?</summary>
              <p>No. El horario se confirma cuando Piel Canela valida la seña por WhatsApp.</p>
            </details>
            <details>
              <summary>¿Necesito crear una cuenta?</summary>
              <p>No. Solo se pedirán los datos mínimos para identificar y coordinar tu solicitud.</p>
            </details>
            <details>
              <summary>¿Qué pasa si no sé qué tratamiento elegir?</summary>
              <p>Podés explorar por categoría y consultar cuando una evaluación previa sea necesaria.</p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
