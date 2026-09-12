import type { Metadata } from "next";
import Link from "next/link";
import { getPublicBookingSettings } from "@/lib/supabase/public-catalog";
import styles from "@/components/layout/PublicInformation.module.css";

export const metadata: Metadata = {
  title: "Condiciones de reserva",
  description: "Condiciones de pre-reserva, seña, confirmación y cancelación de Piel Canela.",
  alternates: { canonical: "/condiciones-de-reserva" },
};

export default async function BookingTermsPage() {
  const settings = await getPublicBookingSettings();
  return (
    <article className={`site-container legal-page ${styles.document}`}>
      <header><h1>Condiciones de reserva</h1><p>La web genera una solicitud provisional. El turno queda confirmado únicamente cuando Piel Canela verifica la seña.</p></header>
      <section><h2>Pre-reserva</h2><p>Seleccionar un horario no equivale a una confirmación definitiva. Las solicitudes pendientes pueden vencer y liberar el horario si la seña no se coordina dentro del plazo informado.</p></section>
      <section><h2>Seña</h2><p>{settings.depositText?.trim() || "Consultá con recepción el monto y el plazo de la seña antes de realizar una transferencia."}</p><p>Esta web no cobra pagos online. Recepción verifica la transferencia y confirma el turno.</p></section>
      <section><h2>Cancelaciones y cambios</h2><p>{settings.cancellationPolicy?.trim() || "Consultá con recepción las condiciones de reprogramación, cancelación y devolución antes de abonar. Si necesitás cambiar un turno, comunicate con la mayor anticipación posible."}</p></section>
      <section><h2>Ausencias</h2><p>{settings.noShowPolicy?.trim() || "Consultá con recepción las condiciones ante una ausencia antes de abonar."}</p></section>
      <section><h2>Combos y paquetes de sesiones</h2><p>Cuando estén disponibles, los combos incluyen las zonas indicadas en su ficha; no se agregan zonas individuales durante la reserva. El precio total, las sesiones y la vigencia corresponden a la propuesta elegida. El precio equivalente por sesión es informativo, no un nuevo cargo por cada turno. Un combo no acumula el precio promocional de un Especial del mes.</p><p>La pre-reserva online agenda únicamente la primera sesión. Recepción activa el paquete al confirmar la seña y coordina las sesiones restantes. Cada paquete repite las mismas zonas.</p></section>
      <section><h2>Uso y vigencia del paquete</h2><p>Recepción registra el uso de cada sesión. Una cancelación no consume una sesión automáticamente. Ante una ausencia, recepción debe resolver si corresponde consumirla o devolverla según las condiciones acordadas.</p><p>La vigencia contratada se conserva aunque luego se edite el combo. Un paquete vencido no permite asignar nuevas sesiones; cualquier extensión debe ser autorizada y registrada por recepción.</p><p>{settings.packagePolicy?.trim() || "Consultá antes de contratar qué ocurre con las sesiones no utilizadas y las devoluciones."}</p></section>
      <section><h2>Tratamientos que requieren consulta</h2><p>Cuando una propuesta requiere evaluación previa, la ficha lo indica. La información del sitio orienta y no reemplaza una evaluación profesional.</p></section>
      <p className="legal-page__back"><Link className="text-link" href="/tratamientos">Explorar tratamientos</Link></p>
    </article>
  );
}
