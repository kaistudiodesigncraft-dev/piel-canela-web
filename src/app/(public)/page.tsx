import { ArrowRight, Check, MessageCircleMore } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CategoryEntryCard } from "@/components/treatments/CategoryEntryCard";
import { MonthlySpecialsSection } from "@/components/specials/MonthlySpecialsSection";
import { EditableSectionMedia, editableSurfaceClassName } from "@/components/content/EditableSectionMedia";
import { getPublicMonthlySpecials } from "@/lib/treatments";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";
import { getSiteContent } from "@/lib/supabase/site-content";
import { siteContentMap } from "@/domain/site-content";

export const revalidate = 3600;

export default async function HomePage() {
  const [{
    categories: treatmentCategories,
    treatments,
    monthlySpecials,
  }, siteFields] = await Promise.all([
    getPublicCatalogSnapshot(),
    getSiteContent(),
  ]);
  const content = siteContentMap(siteFields);
  const text = (key: Parameters<typeof content.get>[0]) => content.get(key)?.value ?? "";
  const heroImage = content.get("hero_image");
  const categoriesBackground = content.get("categories_background");
  const specialsBackground = content.get("specials_background");
  const approachBackground = content.get("approach_background");
  const bookingBackground = content.get("booking_background");
  const faqBackground = content.get("faq_background");
  const publicSpecials = getPublicMonthlySpecials(monthlySpecials);

  return (
    <>
      <section className="home-hero">
        <div className="site-container home-hero__grid">
          <div className="home-hero__content">
            <p className="eyebrow">{text("hero_eyebrow")}</p>
            <h1>{text("hero_title")}</h1>
            <p className="home-hero__lead">
              {text("hero_lead")}
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
          <div className="home-hero__visual">
            <div className="home-hero__image-frame">
              <Image
                src={heroImage?.value || "/images/treatment-massage-concept.png"}
                alt={heroImage?.imageAlt ?? "Imagen principal de Piel Canela"}
                fill
                priority
                sizes="(max-width: 767px) 92vw, 48vw"
                style={{ objectPosition: `${heroImage?.settings.focalX ?? 38}% ${heroImage?.settings.focalY ?? 50}%` }}
              />
            </div>
            <p className="home-hero__caption">{text("hero_image_caption")}</p>
          </div>
        </div>
      </section>

      <section className={editableSurfaceClassName("section section--categories", categoriesBackground)} aria-labelledby="categories-title">
        <EditableSectionMedia field={categoriesBackground} />
        <div className="site-container">
          <div className="section-heading section-heading--centered">
            <p className="eyebrow">{text("categories_eyebrow")}</p>
            <h2 id="categories-title">{text("categories_title")}</h2>
            <p>{text("categories_lead")}</p>
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
        heading={{
          eyebrow: text("specials_eyebrow"),
          title: text("specials_title"),
          lead: text("specials_lead"),
          background: specialsBackground,
        }}
      />

      <section className={editableSurfaceClassName("section section--approach", approachBackground)} id="piel-canela" aria-labelledby="approach-title">
        <EditableSectionMedia field={approachBackground} />
        <div className="site-container approach-grid">
          <div className="approach-grid__intro">
            <p className="eyebrow">{text("approach_eyebrow")}</p>
            <h2 id="approach-title">{text("approach_title")}</h2>
          </div>
          <div className="approach-grid__copy">
            <p>
              {text("approach_body_primary")}
            </p>
            <p>
              {text("approach_body_secondary")}
            </p>
          </div>
        </div>
      </section>

      <section className={editableSurfaceClassName("section section--steps", bookingBackground)} aria-labelledby="steps-title">
        <EditableSectionMedia field={bookingBackground} />
        <div className="site-container">
          <div className="section-heading">
            <p className="eyebrow">{text("booking_eyebrow")}</p>
            <h2 id="steps-title">{text("booking_title")}</h2>
          </div>
          <ol className="booking-steps">
            <li><span>{text("booking_step_1_title")}</span><p>{text("booking_step_1_text")}</p></li>
            <li><span>{text("booking_step_2_title")}</span><p>{text("booking_step_2_text")}</p></li>
            <li><span>{text("booking_step_3_title")}</span><p>{text("booking_step_3_text")}</p></li>
            <li><span>{text("booking_step_4_title")}</span><p>{text("booking_step_4_text")}</p></li>
          </ol>
        </div>
      </section>

      <section className={editableSurfaceClassName("section section--faq", faqBackground)} aria-labelledby="faq-title">
        <EditableSectionMedia field={faqBackground} />
        <div className="site-container faq-grid">
          <div className="section-heading">
            <p className="eyebrow">{text("faq_eyebrow")}</p>
            <h2 id="faq-title">{text("faq_title")}</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>{text("faq_1_question")}</summary>
              <p>{text("faq_1_answer")}</p>
            </details>
            <details>
              <summary>{text("faq_2_question")}</summary>
              <p>{text("faq_2_answer")}</p>
            </details>
            <details>
              <summary>{text("faq_3_question")}</summary>
              <p>{text("faq_3_answer")}</p>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
