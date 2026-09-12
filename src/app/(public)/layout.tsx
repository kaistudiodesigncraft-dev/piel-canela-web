import type { Metadata } from "next";
import { BetaNotice } from "@/components/layout/BetaNotice";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getPublicBookingSettings, getPublicCatalogSnapshot } from "@/lib/supabase/public-catalog";
import { getPublicMonthlySpecials } from "@/lib/treatments";
import { isBetaRelease } from "../../../scripts/release-environment.mjs";

export const metadata: Metadata = isBetaRelease()
  ? {
      robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      },
    }
  : {};

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [settings, hasMonthlySpecials] = await Promise.all([
    getPublicBookingSettings(),
    getPublicCatalogSnapshot()
      .then(({ monthlySpecials }) => getPublicMonthlySpecials(monthlySpecials).length > 0)
      .catch(() => false),
  ]);
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <BetaNotice />
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter settings={settings} hasMonthlySpecials={hasMonthlySpecials} />
    </div>
  );
}
