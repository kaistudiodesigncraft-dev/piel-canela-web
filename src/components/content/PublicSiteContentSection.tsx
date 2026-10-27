import type { MonthlySpecial, Treatment, TreatmentCategory } from "@/domain/treatment";
import type { SiteContentField, SiteContentSection } from "@/domain/site-content";
import { siteContentMap } from "@/domain/site-content";
import { getPublicMonthlySpecials } from "@/lib/treatments";
import { HomeHero } from "@/components/home/HomeHero";
import { CategoryEntryCard } from "@/components/treatments/CategoryEntryCard";
import { MonthlySpecialsSection } from "@/components/specials/MonthlySpecialsSection";
import { EditableSectionMedia, editableSurfaceClassName } from "./EditableSectionMedia";

interface PublicSiteContentSectionProps {
  section: SiteContentSection;
  fields: readonly SiteContentField[];
  categories?: readonly TreatmentCategory[];
  treatments?: readonly Treatment[];
  monthlySpecials?: readonly MonthlySpecial[];
}

export function PublicSiteContentSection({
  section,
  fields,
  categories = [],
  treatments = [],
  monthlySpecials = [],
}: PublicSiteContentSectionProps) {
  const content = siteContentMap(fields);
  const text = (key: Parameters<typeof content.get>[0]) => content.get(key)?.value ?? "";

  if (section === "hero") {
    return <HomeHero eyebrow={text("hero_eyebrow")} title={text("hero_title")} lead={text("hero_lead")} caption={text("hero_image_caption")} image={content.get("hero_image")} />;
  }

  if (section === "categories") {
    const background = content.get("categories_background");
    return <section className={editableSurfaceClassName("section section--categories", background)} aria-labelledby="categories-title">
      <EditableSectionMedia field={background} />
      <div className="site-container">
        <div className="section-heading section-heading--centered">
          <p className="eyebrow">{text("categories_eyebrow")}</p>
          <h2 id="categories-title">{text("categories_title")}</h2>
          <p>{text("categories_lead")}</p>
        </div>
        <div className="category-entry-grid">
          {categories.map((category) => <CategoryEntryCard key={category.id} category={category} />)}
        </div>
      </div>
    </section>;
  }

  if (section === "specials") {
    return <MonthlySpecialsSection
      specials={getPublicMonthlySpecials(monthlySpecials)} treatments={treatments} categories={categories}
      heading={{ eyebrow: text("specials_eyebrow"), title: text("specials_title"), lead: text("specials_lead"), background: content.get("specials_background") }}
    />;
  }

  if (section === "approach") {
    const background = content.get("approach_background");
    return <section className={editableSurfaceClassName("section section--approach", background)} id="piel-canela" aria-labelledby="approach-title">
      <EditableSectionMedia field={background} />
      <div className="site-container approach-grid">
        <div className="approach-grid__intro"><p className="eyebrow">{text("approach_eyebrow")}</p><h2 id="approach-title">{text("approach_title")}</h2></div>
        <div className="approach-grid__copy"><p>{text("approach_body_primary")}</p><p>{text("approach_body_secondary")}</p></div>
      </div>
    </section>;
  }

  if (section === "booking") {
    const background = content.get("booking_background");
    return <section className={editableSurfaceClassName("section section--steps", background)} aria-labelledby="steps-title">
      <EditableSectionMedia field={background} />
      <div className="site-container">
        <div className="section-heading"><p className="eyebrow">{text("booking_eyebrow")}</p><h2 id="steps-title">{text("booking_title")}</h2></div>
        <ol className="booking-steps">
          {[1, 2, 3, 4].map((step) => <li key={step}><span>{text(`booking_step_${step}_title` as Parameters<typeof content.get>[0])}</span><p>{text(`booking_step_${step}_text` as Parameters<typeof content.get>[0])}</p></li>)}
        </ol>
      </div>
    </section>;
  }

  if (section === "faq") {
    const background = content.get("faq_background");
    return <section className={editableSurfaceClassName("section section--faq", background)} aria-labelledby="faq-title">
      <EditableSectionMedia field={background} />
      <div className="site-container faq-grid">
        <div className="section-heading"><p className="eyebrow">{text("faq_eyebrow")}</p><h2 id="faq-title">{text("faq_title")}</h2></div>
        <div className="faq-list">
          {[1, 2, 3].map((item) => <details key={item}><summary>{text(`faq_${item}_question` as Parameters<typeof content.get>[0])}</summary><p>{text(`faq_${item}_answer` as Parameters<typeof content.get>[0])}</p></details>)}
        </div>
      </div>
    </section>;
  }

  const prefix = section === "catalog_header" ? "catalog_header" : "booking_header";
  const image = content.get(`${prefix}_image`);
  return <section className={editableSurfaceClassName(`page-hero page-hero--${section === "catalog_header" ? "catalog" : "booking"}`, image)}>
    <EditableSectionMedia field={image} priority />
    <div className="site-container page-hero__content">
      <p className="eyebrow">{text(`${prefix}_eyebrow`)}</p>
      <h1>{text(`${prefix}_title`)}</h1>
      <p>{text(`${prefix}_lead`)}</p>
    </div>
  </section>;
}
