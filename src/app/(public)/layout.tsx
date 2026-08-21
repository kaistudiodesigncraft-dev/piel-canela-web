import { FixtureNotice } from "@/components/layout/FixtureNotice";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getPublicBookingSettings } from "@/lib/supabase/public-catalog";

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getPublicBookingSettings();
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <FixtureNotice />
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter settings={settings} />
    </div>
  );
}
