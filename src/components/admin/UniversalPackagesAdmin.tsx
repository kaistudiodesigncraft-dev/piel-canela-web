"use client";

import { CheckCircle2, Clock3, PackageCheck, XCircle } from "lucide-react";
import {
  decideUniversalPackageSession,
  extendUniversalPackageValidity,
  registerUniversalPackage,
  updateUniversalPackagePayment,
} from "@/app/admin/paquetes/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";
import { UniversalPackageSessionScheduler } from "@/components/admin/UniversalPackageSessionScheduler";
import type { ServicePackageRules } from "@/lib/booking-config";
import { calculateServicePackageBalance, suggestServicePackageOutcome } from "@/lib/service-package";
import { formatPrice } from "@/lib/format";

export interface UniversalPackageBookingCandidate {
  id: string;
  booking_code: string;
  starts_at: string;
  status: string;
  customer: { full_name: string; phone: string } | null;
  treatment: { name: string } | null;
  offering: { name: string; session_count: number } | null;
}

export interface UniversalPackageSessionRow {
  id: string;
  booking_id: string;
  session_number: number;
  status: "reserved" | "completed" | "released" | "lost";
  suggested_outcome: "completed" | "released" | "lost" | null;
  decision_is_exception: boolean;
  decision_reason: string | null;
  reschedule_count_snapshot: number;
  booking: {
    booking_code: string;
    starts_at: string;
    status: string;
    professional: { public_name: string | null; full_name: string } | null;
  } | null;
}

export interface UniversalPackageRow {
  id: string;
  offering_name_snapshot: string;
  total_sessions: number;
  price_total_snapshot_cents: number;
  price_per_session_snapshot_cents: number;
  validity_until: string;
  payment_status: "deposit_pending" | "deposit_paid" | "paid_in_full";
  status: "active" | "completed" | "expired" | "suspended";
  rules_snapshot: ServicePackageRules;
  customer: { full_name: string; phone: string } | null;
  treatment: { name: string } | null;
  sessions: UniversalPackageSessionRow[];
}

const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Cordoba" });
const paymentLabels = { deposit_pending: "Seña pendiente", deposit_paid: "Seña pagada", paid_in_full: "Pago total" } as const;

function PurchaseForm({ candidates }: { candidates: UniversalPackageBookingCandidate[] }) {
  if (!candidates.length) return <p className="admin-field-note">No hay pre-reservas de paquetes pendientes de registrar.</p>;
  return <form action={registerUniversalPackage} className="admin-form">
    <div className="admin-form-grid">
      <label>Pre-reserva<select name="bookingId" required defaultValue=""><option value="" disabled>Elegir pre-reserva</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.booking_code} · {candidate.customer?.full_name ?? "Cliente"} · {candidate.treatment?.name ?? "Tratamiento"} · {candidate.offering?.name ?? "Paquete"}</option>)}</select></label>
      <label>Estado del pago<select name="paymentStatus" defaultValue="deposit_pending"><option value="deposit_pending">Seña pendiente</option><option value="deposit_paid">Seña pagada</option><option value="paid_in_full">Pagado total</option></select></label>
    </div>
    <p className="admin-field-note">Si registrás un pago, la reserva inicial se confirma en la misma operación.</p>
    <AdminSubmitButton pendingLabel="Registrando…">Registrar compra</AdminSubmitButton>
  </form>;
}

function SessionDecision({ packageRow, session, referenceTime }: { packageRow: UniversalPackageRow; session: UniversalPackageSessionRow; referenceTime: string }) {
  if (!session.booking || session.status !== "reserved") return null;
  const releaseSuggestion = suggestServicePackageOutcome({
    rules: packageRow.rules_snapshot,
    event: "released",
    appointmentStartsAt: new Date(session.booking.starts_at),
    eventAt: new Date(referenceTime),
  });
  const absenceSuggestion = suggestServicePackageOutcome({
    rules: packageRow.rules_snapshot,
    event: "absence",
    appointmentStartsAt: new Date(session.booking.starts_at),
    eventAt: new Date(referenceTime),
  });
  return <div className="package-consumption-decision">
    <p>Sugerencia actual: liberar → <strong>{releaseSuggestion === "released" ? "devuelve la sesión" : "consume la sesión"}</strong>; ausencia → <strong>{absenceSuggestion === "lost" ? "consume la sesión" : "devuelve la sesión"}</strong>.</p>
    <form action={decideUniversalPackageSession}>
      <input type="hidden" name="packageId" value={packageRow.id} /><input type="hidden" name="bookingId" value={session.booking_id} /><input type="hidden" name="action" value="complete" />
      <AdminSubmitButton className="button button--quiet" pendingLabel="Cerrando…"><CheckCircle2 aria-hidden="true" />Completar</AdminSubmitButton>
    </form>
    <form action={decideUniversalPackageSession}>
      <input type="hidden" name="packageId" value={packageRow.id} /><input type="hidden" name="bookingId" value={session.booking_id} /><input type="hidden" name="action" value="release" />
      <label><span className="sr-only">Motivo para liberar</span><input name="reason" minLength={3} maxLength={500} placeholder="Motivo de la liberación" required /></label><AdminSubmitButton className="button button--quiet" pendingLabel="Liberando…"><Clock3 aria-hidden="true" />Liberar</AdminSubmitButton>
    </form>
    <form action={decideUniversalPackageSession}>
      <input type="hidden" name="packageId" value={packageRow.id} /><input type="hidden" name="bookingId" value={session.booking_id} /><input type="hidden" name="action" value="lose" />
      <label><span className="sr-only">Motivo para consumir</span><input name="reason" minLength={3} maxLength={500} placeholder="Motivo del consumo" required /></label><AdminSubmitButton className="button button--quiet" pendingLabel="Cerrando…"><XCircle aria-hidden="true" />Marcar perdida</AdminSubmitButton>
    </form>
  </div>;
}

function UniversalPackageCard({ item, referenceTime }: { item: UniversalPackageRow; referenceTime: string }) {
  const balance = calculateServicePackageBalance({ totalSessions: item.total_sessions, sessions: item.sessions });
  const effectiveStatus = item.status === "active" && new Date(item.validity_until).getTime() <= new Date(referenceTime).getTime() ? "expired" : item.status;
  return <article className="package-admin-item">
    <header><div><span className={`status-badge status-${effectiveStatus === "active" ? "confirmed" : "expired"}`}>{effectiveStatus === "active" ? "Activo" : effectiveStatus === "completed" ? "Completado" : effectiveStatus === "suspended" ? "Suspendido" : "Vencido"}</span><h3>{item.offering_name_snapshot}</h3><p>{item.customer?.full_name ?? "Cliente"} · {item.customer?.phone ?? "Sin teléfono"}</p><small>{item.treatment?.name ?? "Tratamiento"} · {paymentLabels[item.payment_status]}</small></div><dl className="numeric"><div><dt>Disponibles</dt><dd>{balance.balance} de {balance.total}</dd></div><div><dt>Vence</dt><dd>{dateTime.format(new Date(item.validity_until))}</dd></div><div><dt>Contratado</dt><dd>{formatPrice(item.price_total_snapshot_cents)}</dd></div></dl></header>
    {item.payment_status !== "paid_in_full" ? <form action={updateUniversalPackagePayment} className="admin-form admin-form--booking-action"><input type="hidden" name="packageId" value={item.id} /><label>Actualizar pago<select name="paymentStatus" defaultValue={item.payment_status === "deposit_pending" ? "deposit_paid" : "paid_in_full"}>{item.payment_status === "deposit_pending" ? <option value="deposit_paid">Confirmar seña</option> : null}<option value="paid_in_full">Confirmar pago total</option></select></label><AdminSubmitButton pendingLabel="Confirmando…">Guardar pago</AdminSubmitButton></form> : null}
    {effectiveStatus === "active" && balance.balance > 0 ? <UniversalPackageSessionScheduler packageId={item.id} expiresAt={item.validity_until} referenceTime={referenceTime} /> : null}
    <div className="package-session-list"><h4>Línea de tiempo</h4>{item.sessions.map((session) => <div key={session.id} className="package-session-row"><span><strong>Sesión {session.session_number} · {session.booking?.booking_code ?? "Sin código"}</strong><small>{session.booking ? dateTime.format(new Date(session.booking.starts_at)) : "Sin fecha"} · {session.status}{session.booking?.professional ? ` · ${session.booking.professional.public_name || session.booking.professional.full_name}` : ""}</small>{session.decision_is_exception ? <small>Excepción confirmada: {session.decision_reason}</small> : null}</span>{session.status === "reserved" ? <div><SessionDecision packageRow={item} session={session} referenceTime={referenceTime} /><details className="admin-disclosure"><summary>Reprogramar</summary><UniversalPackageSessionScheduler packageId={item.id} bookingId={session.booking_id} expiresAt={item.validity_until} referenceTime={referenceTime} /></details></div> : <span className={`status-badge status-${session.status === "completed" ? "confirmed" : "expired"}`}>{session.status === "completed" ? "Completada" : session.status === "released" ? "Liberada" : "Perdida"}</span>}</div>)}</div>
    <details className="admin-disclosure"><summary>Reglas congeladas y vigencia</summary><div className="admin-form"><p>{item.rules_snapshot.sessionsCount} sesiones · {item.rules_snapshot.validityDays} días desde {item.rules_snapshot.validityStartsFrom === "purchase" ? "la compra" : "la primera sesión"} · aviso de {item.rules_snapshot.releaseNoticeHours} horas.</p>{item.rules_snapshot.conditionsText ? <p>{item.rules_snapshot.conditionsText}</p> : null}<form action={extendUniversalPackageValidity}><input type="hidden" name="packageId" value={item.id} /><input type="hidden" name="expectedValidityUntil" value={item.validity_until} /><label>Días adicionales<input name="additionalDays" type="number" min="1" max="730" required /></label><label>Motivo<textarea name="reason" minLength={3} maxLength={500} required /></label><AdminSubmitButton className="button button--quiet" pendingLabel="Extendiendo…">Extender vigencia</AdminSubmitButton></form></div></details>
  </article>;
}

export function UniversalPackagesAdmin({ packages, candidates, feedback, referenceTime }: { packages: UniversalPackageRow[]; candidates: UniversalPackageBookingCandidate[]; feedback: Record<string, string | undefined>; referenceTime: string }) {
  const expiring = packages.filter((item) => item.status === "active" && new Date(item.validity_until).getTime() > new Date(referenceTime).getTime() && new Date(item.validity_until).getTime() <= new Date(referenceTime).getTime() + 30 * 86_400_000).length;
  return <section className="live-admin__section" aria-labelledby="universal-packages-title"><div className="admin-section-heading"><div><h2 id="universal-packages-title">Paquetes configurables</h2><p>Compras, saldo y sesiones del circuito universal. Los paquetes históricos continúan debajo sin cambios.</p></div><span className="admin-count numeric">{packages.length} paquetes · {expiring} por vencer</span></div>
    {feedback.universalSaved ? <p className="form-message" role="status">La operación quedó registrada.</p> : null}
    {feedback.universalError ? <p className="form-message form-message--error" role="alert">{feedback.universalError === "slot" ? "Ese horario ya no está disponible." : feedback.universalError === "sessions" ? "El paquete ya no tiene sesiones disponibles." : feedback.universalError === "reason" ? "La excepción necesita un motivo." : feedback.universalError === "reschedule" ? "La sesión alcanzó el máximo de reprogramaciones." : feedback.universalError === "stale" ? "La vigencia cambió en otra operación. Actualizá la página antes de volver a extenderla." : "No pudimos completar la operación. No quedó nada a medias."}</p> : null}
    <details className="admin-disclosure" open={candidates.length > 0}><summary>Registrar una compra desde una pre-reserva</summary><PurchaseForm candidates={candidates} /></details>
    {packages.length === 0 ? <div className="admin-empty"><PackageCheck aria-hidden="true" /><h3>Todavía no hay paquetes universales</h3><p>Se crearán desde una pre-reserva de un tratamiento configurado como paquete.</p></div> : <div className="package-admin-list">{packages.map((item) => <UniversalPackageCard key={item.id} item={item} referenceTime={referenceTime} />)}</div>}
  </section>;
}
