import type { Metadata } from "next";
import Link from "next/link";
import { getPublicBookingSettings } from "@/lib/supabase/public-catalog";
import { publicEmailLink, publicWhatsAppLink } from "@/components/layout/public-contact";
import styles from "@/components/layout/PublicInformation.module.css";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Cómo Piel Canela utiliza los datos enviados al generar una pre-reserva.",
  alternates: { canonical: "/privacidad" },
};

export default async function PrivacyPage() {
  const settings = await getPublicBookingSettings();
  const email = publicEmailLink(settings.privacyContactEmail || settings.publicEmail);
  const whatsapp = publicWhatsAppLink(settings.whatsappNumber);
  return (
    <article className={`site-container legal-page ${styles.document}`}>
      <header><h1>Privacidad y uso de datos</h1><p>Información sobre los datos que compartís al consultar y reservar en Piel Canela.</p></header>
      <section><h2>Contacto sobre tus datos</h2>{settings.privacyResponsible?.trim() ? <p>Responsable: {settings.privacyResponsible}</p> : null}<p>Para consultas sobre tus datos, {email ? <a href={email}>escribí a {settings.privacyContactEmail || settings.publicEmail}</a> : whatsapp ? <a href={whatsapp}>comunicate por WhatsApp</a> : "consultá a recepción por el canal en el que coordinaste tu atención"}.</p>{settings.address?.trim() ? <p>{settings.address}</p> : null}</section>
      <section><h2>Qué información solicitamos</h2><p>Para generar una pre-reserva pedimos nombre, teléfono, correo opcional y cualquier observación que decidas compartir. No solicitamos diagnósticos ni historias clínicas mediante este formulario.</p></section>
      <section><h2>Para qué la utilizamos</h2><p>La información se usa para identificar la solicitud, coordinar el turno, comunicar las condiciones de la seña y resolver cambios relacionados con la atención.</p></section>
      <section><h2>Acceso y proveedores técnicos</h2><p>El equipo autorizado de Piel Canela accede a la información para gestionar la atención. La plataforma utiliza Supabase para datos, archivos y acceso administrativo, y Vercel para alojamiento. Kai Studio brinda soporte técnico. Estos servicios pueden involucrar infraestructura fuera de Argentina.</p></section>
      <section><h2>Comunicaciones por WhatsApp</h2><p>Al abrir el enlace de WhatsApp se prepara un resumen de tu solicitud; vos decidís enviarlo. La conversación se realiza en WhatsApp, un servicio de Meta sujeto a sus propias condiciones. Si se habilitan avisos automáticos, el formulario solicitará tu autorización específica. No aceptar esos avisos no impide generar una pre-reserva.</p></section>
      <section><h2>Medición y sesión</h2><p>El sitio incorpora Vercel Web Analytics para estadísticas de navegación y Speed Insights para rendimiento. La disponibilidad efectiva de esas mediciones depende de la configuración del alojamiento. El acceso administrativo utiliza cookies de sesión necesarias para autenticar al personal.</p><p>Consultá <a href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer">la información de privacidad de Vercel Analytics</a> y <a href="https://vercel.com/docs/speed-insights/privacy-policy" target="_blank" rel="noopener noreferrer">la de Speed Insights</a>.</p></section>
      <section><h2>Historial y seguridad</h2><p>La plataforma mantiene el historial de reservas y paquetes y registra cambios administrativos relevantes. Desactivar un tratamiento no elimina ese historial. El acceso al panel requiere autenticación. Evitá incluir información médica o sensible en observaciones o mensajes del turnero.</p></section>
      <section><h2>Tus derechos</h2><p>Podés solicitar acceso, rectificación, actualización o supresión de tus datos mediante el contacto indicado arriba. La solicitud se evalúa según las obligaciones aplicables; no se ofrece un borrado automático desde el turnero.</p><p>La Agencia de Acceso a la Información Pública ofrece <a href="https://www.argentina.gob.ar/aaip/datospersonales/derechos" target="_blank" rel="noopener noreferrer">orientación para ejercer tus derechos y presentar reclamos</a>.</p></section>
      <p className="legal-page__back"><Link className="text-link" href="/">Volver al inicio</Link></p>
    </article>
  );
}
