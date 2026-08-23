import type { Metadata } from "next";
import Link from "next/link";
import { getPublicBookingSettings } from "@/lib/supabase/public-catalog";

export const metadata: Metadata = {
  title: "Condiciones de reserva",
  description: "Condiciones de pre-reserva, seña, confirmación y cancelación de Piel Canela.",
  alternates: { canonical: "/condiciones-de-reserva" },
};

export default async function BookingTermsPage() {
  const settings = await getPublicBookingSettings();
  return (
    <article className="site-container legal-page">
      <header><p className="eyebrow">Antes de reservar</p><h1>Condiciones de reserva</h1><p>La web genera una solicitud provisional. El turno queda confirmado únicamente cuando Piel Canela verifica la seña.</p></header>
      <section><h2>Pre-reserva</h2><p>Seleccionar un horario no equivale a una confirmación definitiva. Las solicitudes pendientes pueden vencer y liberar el horario si la seña no se coordina dentro del plazo informado.</p></section>
      <section><h2>Seña</h2><p>{settings.depositText ?? "El monto, medio de transferencia y plazo para abonar la seña se informan por WhatsApp después de generar la pre-reserva."}</p></section>
      <section><h2>Cancelaciones y cambios</h2><p>{settings.cancellationPolicy ?? "Las condiciones específicas de cancelación o reprogramación se informan durante la confirmación. Si necesitás cambiar un turno, comunicate con la mayor anticipación posible."}</p></section>
      <section><h2>Tratamientos que requieren consulta</h2><p>Cuando una propuesta requiere evaluación previa, la ficha lo indica. La información del sitio orienta y no reemplaza una evaluación profesional.</p></section>
      <p className="legal-page__back"><Link className="text-link" href="/tratamientos">Explorar tratamientos</Link></p>
    </article>
  );
}
