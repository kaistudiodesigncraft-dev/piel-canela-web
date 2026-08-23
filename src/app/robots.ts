import type { MetadataRoute } from "next";
import { isBetaRelease } from "../../scripts/release-environment.mjs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  if (isBetaRelease()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      host: siteUrl,
    };
  }

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/auth/", "/reservar"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
