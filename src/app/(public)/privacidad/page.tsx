import type { Metadata } from "next";
import Link from "next/link";
import { getPublicBookingSettings } from "@/lib/supabase/public-catalog";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Cómo Piel Canela utiliza los datos enviados al generar una pre-reserva.",
  alternates: { canonical: "/privacidad" },
};

export default async function PrivacyPage() {
  const settings = await getPublicBookingSettings();
  return (
    <article className="site-container legal-page">
      <header><p className="eyebrow">Información importante</p><h1>Privacidad y uso de datos</h1><p>Última actualización: 23 de agosto de 2026.</p></header>
      <section><h2>Qué información solicitamos</h2><p>Para generar una pre-reserva pedimos nombre, teléfono, correo opcional y cualquier observación que decidas compartir. No solicitamos diagnósticos ni historias clínicas mediante este formulario.</p></section>
      <section><h2>Para qué la utilizamos</h2><p>La información se usa para identificar la solicitud, coordinar el turno, comunicar las condiciones de la seña y resolver cambios relacionados con la atención.</p></section>
      <section><h2>Con quién se comparte</h2><p>Los datos quedan disponibles para el equipo autorizado de Piel Canela y sus proveedores técnicos necesarios para operar la web. Cuando continuás por WhatsApp, esa comunicación también queda sujeta a las condiciones de esa plataforma.</p></section>
      <section><h2>Conservación y seguridad</h2><p>La información se conserva durante el tiempo necesario para administrar la reserva y mantener un historial operativo razonable. El panel requiere autenticación y registra los cambios administrativos relevantes.</p></section>
      <section><h2>Tus opciones</h2><p>Podés solicitar acceso, corrección o eliminación de tus datos comunicándote con Piel Canela{settings.publicEmail ? <> mediante <a href={`mailto:${settings.publicEmail}`}>{settings.publicEmail}</a></> : " por sus canales habituales"}.</p></section>
      <p className="legal-page__back"><Link className="text-link" href="/">Volver al inicio</Link></p>
    </article>
  );
}
