import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import type { SiteContentField } from "@/domain/site-content";
import { EditableSectionMedia, editableSurfaceClassName } from "@/components/content/EditableSectionMedia";
import { MonthlySpecialFeature } from "./MonthlySpecialFeature";
import {
  MonthlySpecialGrid,
  type ResolvedMonthlySpecial,
} from "./MonthlySpecialGrid";

interface MonthlySpecialsSectionProps {
  specials: readonly MonthlySpecial[];
  treatments: readonly Treatment[];
  categories: readonly TreatmentCategory[];
  heading?: {
    eyebrow: string;
    title: string;
    lead: string;
    background?: SiteContentField;
  };
}

export function MonthlySpecialsSection({
  specials,
  treatments,
  categories,
  heading,
}: MonthlySpecialsSectionProps) {
  const items = specials.flatMap<ResolvedMonthlySpecial>((special) => {
    const treatment = treatments.find((item) => item.id === special.treatmentId);
    const category = categories.find((item) => item.id === treatment?.categoryId);
    return treatment && category ? [{ special, treatment, category }] : [];
  });

  if (items.length === 0) return null;
  const firstItem = items[0];

  return (
    <section className={editableSurfaceClassName("section section--specials", heading?.background)} id="especiales" aria-labelledby="specials-title">
      <EditableSectionMedia field={heading?.background} />
      <div className="site-container">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">{heading?.eyebrow || "Propuestas temporales"}</p>
            <h2 id="specials-title">{heading?.title || "Especiales del mes"}</h2>
          </div>
          <p>{heading?.lead || "Tratamientos seleccionados por Piel Canela con vigencia y valor promocional."}</p>
        </div>
        {items.length === 1 && firstItem ? (
          <MonthlySpecialFeature {...firstItem} />
        ) : (
          <MonthlySpecialGrid items={items} />
        )}
      </div>
    </section>
  );
}
