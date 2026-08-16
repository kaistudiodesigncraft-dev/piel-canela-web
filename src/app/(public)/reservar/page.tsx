import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingPageClient } from "@/components/booking/BookingPageClient";

export const metadata: Metadata = {
  title: "Reservar",
  description: "Inicio de la pre-reserva de un tratamiento en Piel Canela.",
};

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="catalog-skeleton" aria-label="Cargando reserva" />}>
      <BookingPageClient />
    </Suspense>
  );
}
