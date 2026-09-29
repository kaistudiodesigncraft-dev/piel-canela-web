import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/layout/PublicInformation.module.css";

export const metadata: Metadata = {
  title: "Política de cookies",
  description: "Cookies técnicas, sesión administrativa y medición opcional en Piel Canela.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <article className={`site-container legal-page ${styles.document}`}>
      <header>
        <h1>Política de cookies</h1>
        <p>Información clara sobre las tecnologías necesarias y opcionales que usa la plataforma de Piel Canela.</p>
      </header>

      <section>
        <h2>Cookies necesarias</h2>
        <p>El panel administrativo utiliza cookies de sesión de Supabase para mantener el acceso seguro de recepción, agencia y Kai Studio. Estas cookies son necesarias para iniciar sesión, cerrar sesión, recuperar contraseña y proteger rutas administrativas.</p>
        <p>Sin estas cookies, el panel no puede funcionar correctamente.</p>
      </section>

      <section>
        <h2>Medición opcional</h2>
        <p>La web puede activar Vercel Web Analytics y Speed Insights para entender uso general y rendimiento. Esa medición se carga únicamente cuando aceptás “Aceptar medición” en el aviso de privacidad.</p>
        <p>No se usa para vender datos personales ni para perfilar tratamientos. El objetivo es detectar problemas de carga, navegación y experiencia.</p>
      </section>

      <section>
        <h2>WhatsApp y servicios externos</h2>
        <p>Cuando tocás un enlace de WhatsApp, salís de esta web y continuás en un servicio de Meta. El mensaje se prepara con datos de tu pre-reserva, pero solo se envía si vos decidís mandarlo desde WhatsApp.</p>
      </section>

      <section>
        <h2>Cómo cambiar tu decisión</h2>
        <p>Podés cambiar tu decisión desde “Preferencias de privacidad”, al pie de cualquier página. Elegir “Solo necesarias” desactiva la medición opcional; no borra mediciones ya enviadas. Las cookies de sesión administrativa se gestionan al cerrar sesión.</p>
      </section>

      <section>
        <h2>Más información</h2>
        <p>Consultá también la <Link href="/privacidad">política de privacidad</Link> y las <Link href="/condiciones-de-reserva">condiciones de reserva</Link>.</p>
      </section>

      <p className="legal-page__back"><Link className="text-link" href="/">Volver al inicio</Link></p>
    </article>
  );
}
