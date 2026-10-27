import { notFound } from "next/navigation";
import { ContentPreviewReceiver } from "@/components/admin/ContentPreviewReceiver";
import type { SiteContentSection } from "@/domain/site-content";
import { requireAdmin } from "@/lib/admin/require-admin";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";
import { getSiteContentDrafts } from "@/lib/supabase/site-content";

const sections = new Set<SiteContentSection>(["hero", "categories", "specials", "approach", "booking", "faq", "catalog_header", "booking_header"]);

export default async function ContentPreviewPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section: requestedSection } = await searchParams;
  if (!requestedSection || !sections.has(requestedSection as SiteContentSection)) notFound();
  const section = requestedSection as SiteContentSection;
  const { supabase } = await requireAdmin();
  const [fields, catalog] = await Promise.all([
    getSiteContentDrafts(supabase),
    getPublicCatalogSnapshot().catch(() => ({ categories: [], treatments: [], monthlySpecials: [], source: "supabase" as const })),
  ]);
  return <ContentPreviewReceiver
    initialSection={section}
    initialFields={fields.filter((field) => field.section === section)}
    categories={catalog.categories}
    treatments={catalog.treatments}
    monthlySpecials={catalog.monthlySpecials}
  />;
}
