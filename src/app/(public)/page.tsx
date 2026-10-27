import { HomeMotion } from "@/components/home/HomeMotion";
import { PublicSiteContentSection } from "@/components/content/PublicSiteContentSection";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";
import { getSiteContent } from "@/lib/supabase/site-content";
import styles from "./home.module.css";

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
  return (
    <HomeMotion className={styles.home}>
      {(["hero", "categories", "specials", "approach", "booking", "faq"] as const).map((section) => (
        <PublicSiteContentSection key={section} section={section} fields={siteFields} categories={treatmentCategories} treatments={treatments} monthlySpecials={monthlySpecials} />
      ))}
    </HomeMotion>
  );
}
