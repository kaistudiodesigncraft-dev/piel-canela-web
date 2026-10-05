import type { Metadata } from "next";
import localFont from "next/font/local";
import { ConsentManagedInsights } from "@/components/layout/ConsentManagedInsights";
import "./globals.css";
import "./ux-refinements.css";
import "./brand-system.css";

const monaSans = localFont({
  src: "./fonts/MonaSans-Variable.woff2",
  variable: "--font-heading",
  display: "swap",
  weight: "200 900",
  fallback: ["Arial", "sans-serif"],
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Piel Canela | Bienestar, estética y recuperación",
    template: "%s | Piel Canela",
  },
  description:
    "Conocé los tratamientos de Piel Canela, compará duración y precio, y comenzá tu pre-reserva.",
  icons: {
    icon: "/brand/favicon.webp",
    shortcut: "/brand/favicon.webp",
    apple: "/brand/favicon.webp",
  },
  alternates: { canonical: "/" },
  openGraph: {
    title: "Piel Canela",
    description: "Bienestar, estética y recuperación con información clara.",
    locale: "es_AR",
    type: "website",
    siteName: "Piel Canela",
    url: "/",
    images: [{
      url: "/brand/key-visual-care.jpg",
      width: 2554,
      height: 946,
      alt: "Piel Canela, bienestar, estética y recuperación",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Piel Canela",
    description: "Bienestar, estética y recuperación con información clara.",
    images: ["/brand/key-visual-care.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={monaSans.variable} data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/kvl3xtg.css" />
      </head>
      <body>{children}<ConsentManagedInsights /></body>
    </html>
  );
}
