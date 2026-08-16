import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="admin-product-shell admin-product-shell--auth">
      <a className="skip-link" href="#auth-content">Saltar al contenido</a>
      <main id="auth-content">{children}</main>
    </div>
  );
}
