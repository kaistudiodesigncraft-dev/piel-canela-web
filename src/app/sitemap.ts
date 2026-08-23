import type { MetadataRoute } from "next";
import { getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { treatments } = await getPublicCatalogSnapshot();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/tratamientos`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/condiciones-de-reserva`, changeFrequency: "monthly", priority: 0.4 },
  ];

  return [
    ...staticRoutes,
    ...treatments.filter((treatment) => treatment.isActive).map((treatment) => ({
      url: `${siteUrl}/tratamientos/${treatment.slug}`,
      lastModified: treatment.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
