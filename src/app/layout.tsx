import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const monaSans = localFont({
  src: "./fonts/MonaSans-Variable.woff2",
  variable: "--font-heading",
  display: "swap",
  weight: "200 900",
  fallback: ["Arial", "sans-serif"],
  preload: true,
});

const atkinson = localFont({
  src: "./fonts/AtkinsonHyperlegibleNext-Variable.ttf",
  variable: "--font-body",
  display: "swap",
  weight: "200 800",
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
  alternates: { canonical: "/" },
  openGraph: {
    title: "Piel Canela",
    description: "Bienestar, estética y recuperación con información clara.",
    locale: "es_AR",
    type: "website",
    siteName: "Piel Canela",
    url: "/",
    images: [{
      url: "/images/treatment-massage-concept.png",
      width: 1086,
      height: 1449,
      alt: "Piel Canela, bienestar, estética y recuperación",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Piel Canela",
    description: "Bienestar, estética y recuperación con información clara.",
    images: ["/images/treatment-massage-concept.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${monaSans.variable} ${atkinson.variable}`}>
      <body>{children}<Analytics /><SpeedInsights /></body>
    </html>
  );
}
