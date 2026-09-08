import { CalendarPlus, CheckCircle2, PackageCheck, RotateCcw } from "lucide-react";
import { decidePackageConsumption, extendPackageValidity, schedulePackageSession } from "@/app/admin/paquetes/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";
import { formatPrice } from "@/lib/format";

interface PackageBooking { id: string; booking_code: string; starts_at: string; status: string; consumed: boolean; restored: boolean }
interface PackageRow { id: string; combo_name_snapshot: string; total_sessions: number; fixed_price_snapshot_cents: number; activated_at: string; expires_at: string; status: string; customer: { full_name: string; phone: string } | null; bookings: PackageBooking[] }
const dateTime = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Argentina/Cordoba" });

function PackageConsumptionDecision({ booking }: { booking: PackageBooking }) {
  const consumed = booking.consumed && !booking.restored;
  const hasDecision = booking.consumed || booking.restored;
  const options = hasDecision
    ? [{ consume: !consumed, label: consumed ? "Devolver sesión" : "Consumir sesión", icon: consumed ? "restore" : "consume" }]
    : [
        { consume: true, label: "Consumir sesión", icon: "consume" },
        { consume: false, label: "No consumir", icon: "restore" },
      ];

  return <div className="package-consumption-decision">
    {!hasDecision ? <p>{booking.status === "no_show" ? "¿La ausencia consume esta sesión?" : "Registrá si esta visita consume una sesión."}</p> : null}
    {options.map((option) => <form action={decidePackageConsumption} key={String(option.consume)}>
      <input type="hidden" name="bookingId" value={booking.id} />
      <input type="hidden" name="consume" value={String(option.consume)} />
      <label><span className="sr-only">Motivo de la decisión</span><input name="reason" minLength={3} maxLength={500} placeholder={option.consume ? "Motivo para consumir" : "Motivo para no consumir"} required /></label>
      <AdminSubmitButton className="button button--quiet" pendingLabel="Registrando…">{option.icon === "restore" ? <RotateCcw aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{option.label}</AdminSubmitButton>
    </form>)}
  </div>;
}

export function PackagesAdmin({ packages, feedback, referenceTime }: { packages: PackageRow[]; feedback: Record<string, string | undefined>; referenceTime: string }) {
  const referenceTimestamp = new Date(referenceTime).getTime();
  return <section className="live-admin__section" aria-labelledby="packages-title"><div className="admin-section-heading"><div><h2 id="packages-title">Paquetes de sesiones</h2><p>Activados al confirmar la seña. Las sesiones posteriores se asignan y consumen desde acá.</p></div><span className="admin-count numeric">{packages.length} paquetes</span></div>
    {feedback.packageScheduled === "1" || feedback.redemptionSaved === "1" || feedback.extensionSaved === "1" ? <p className="form-message" role="status">La operación quedó registrada.</p> : null}
    {feedback.packageError || feedback.redemptionError || feedback.extensionError ? <p className="form-message form-message--error" role="alert">No pudimos completar la operación. Revisá vigencia, sesiones restantes y disponibilidad.</p> : null}
    {packages.length === 0 ? <div className="admin-empty"><PackageCheck aria-hidden="true" /><h3>Todavía no hay paquetes activos</h3><p>Aparecerán automáticamente cuando confirmes la seña de una reserva con paquete.</p></div> : <div className="package-admin-list">{packages.map((item) => {
      const consumed = item.bookings.filter((booking) => booking.consumed && !booking.restored).length;
      const remaining = Math.max(0, item.total_sessions - consumed);
      const effectiveStatus = item.status === "active" && new Date(item.expires_at).getTime() <= referenceTimestamp ? "expired" : item.status;
      const statusLabel = effectiveStatus === "active" ? "Activo" : effectiveStatus === "completed" ? "Completado" : effectiveStatus === "cancelled" ? "Cancelado" : "Vencido";
      return <article key={item.id} className="package-admin-item"><header><div><span className={`status-badge status-${effectiveStatus === "active" ? "confirmed" : "expired"}`}>{statusLabel}</span><h3>{item.combo_name_snapshot}</h3><p>{item.customer?.full_name ?? "Cliente"} · {item.customer?.phone}</p></div><dl className="numeric"><div><dt>Sin consumir</dt><dd>{remaining} de {item.total_sessions}</dd></div><div><dt>Vence</dt><dd>{dateTime.format(new Date(item.expires_at))}</dd></div><div><dt>Contratado</dt><dd>{formatPrice(item.fixed_price_snapshot_cents)}</dd></div></dl></header>
        {effectiveStatus === "active" && remaining > 0 ? <form action={schedulePackageSession} className="admin-form admin-form--booking-action"><input type="hidden" name="packageId" value={item.id} /><div><CalendarPlus aria-hidden="true" /><h4>Asignar próxima sesión</h4></div><label>Fecha y hora<input type="datetime-local" name="startsAt" required /></label><label>Nota interna<input name="internalNotes" maxLength={1000} /></label><AdminSubmitButton pendingLabel="Asignando…">Asignar sesión</AdminSubmitButton></form> : null}
        <div className="package-session-list"><h4>Sesiones vinculadas</h4>{item.bookings.map((booking) => <div key={booking.id} className="package-session-row"><span><strong>{booking.booking_code}</strong><small>{dateTime.format(new Date(booking.starts_at))} · {booking.status}</small></span>{booking.status === "completed" || booking.status === "no_show" ? <PackageConsumptionDecision booking={booking} /> : <span className="status-badge status-awaiting_deposit">Pendiente de resultado</span>}</div>)}</div>
        <details className="admin-disclosure"><summary><span>Extender vigencia</span></summary><form action={extendPackageValidity} className="admin-form"><input type="hidden" name="packageId" value={item.id} /><label>Nueva fecha<input type="datetime-local" name="expiresAt" required /></label><label>Motivo<textarea name="reason" minLength={3} maxLength={500} required /></label><AdminSubmitButton className="button button--quiet" pendingLabel="Guardando…">Guardar extensión</AdminSubmitButton></form></details>
      </article>;
    })}</div>}
  </section>;
}
