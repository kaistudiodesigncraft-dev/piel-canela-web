import { FixtureNotice } from "@/components/layout/FixtureNotice";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <FixtureNotice />
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}
