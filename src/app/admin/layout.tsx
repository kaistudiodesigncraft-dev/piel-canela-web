import type { Metadata } from "next";

// Every admin route depends on the request session and live Supabase data.
// Keeping the boundary dynamic also prevents fixture-only CI builds from
// attempting to prerender authenticated pages without credentials.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="admin-product-shell">
      <a className="skip-link" href="#admin-content">Saltar al contenido</a>
      <main id="admin-content">{children}</main>
    </div>
  );
}
