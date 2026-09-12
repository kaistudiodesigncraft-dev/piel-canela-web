"use client";

import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  ExternalLink,
  LogOut,
  MessageCircle,
  PauseCircle,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  UserPlus,
  NotebookPen,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { BookingStatusTransitionForm } from "@/components/admin/BookingStatusTransitionForm";
import { WeeklyAvailabilityEditor } from "@/components/admin/WeeklyAvailabilityEditor";
import {
  createAvailabilityException,
  createManualBooking,
  createSpecialty,
  deleteAvailabilityException,
  saveMonthlySpecial,
  signOutAdmin,
  toggleSpecialty,
} from "@/app/admin/actions";
import { rescheduleBooking, saveBookingNotes } from "@/app/admin/reservas/actions";
import type { BookingStatus } from "@/domain/treatment";
import type { MessageTemplates } from "@/domain/whatsapp";
import {
  buildAdminWhatsAppMessage,
  canRescheduleBooking,
  normalizePhone,
} from "@/lib/admin/customer-operations";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TRANSITIONS,
  toArgentinaDateTimeInput,
} from "@/lib/admin/operations";
import {
  adminAgendaHref,
  type AdminAgendaQuery,
  type AdminAgendaRange,
} from "@/lib/admin/agenda";
import { formatPrice } from "@/lib/format";

interface SpecialtyRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

interface AvailabilityRuleRow {
  id: string;
  specialty_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

interface AvailabilityExceptionRow {
  id: string;
  specialty_id: string;
  kind: "open" | "blocked";
  starts_at: string;
  ends_at: string;
  public_reason: string | null;
  internal_reason: string | null;
}

interface TreatmentRow {
  id: string;
  name: string;
  specialty_id: string;
  duration_minutes: number;
  buffer_minutes: number;
  start_interval_minutes: number;
  selection_mode: "simple" | "closed_combo";
  price_cents: number;
  is_active: boolean;
}

interface TreatmentComboRow {
  id: string;
  treatment_id: string;
  name: string;
  mode: "single_session" | "package";
  session_count: number;
  fixed_price_cents: number;
  is_active: boolean;
}

interface MonthlySpecialRow {
  id: string;
  treatment_id: string;
  title: string;
  short_description: string;
  detail: string;
  image_path: string;
  image_url: string;
  image_alt: string;
  pricing_mode: "special_price" | "combo_catalog";
  special_price_cents: number;
  reference_price_cents: number | null;
  starts_at: string;
  ends_at: string;
  terms: string | null;
  is_active: boolean;
  display_order: number;
}

interface AdminBookingRow {
  messageTemplates?: MessageTemplates;
  id: string;
  booking_code: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  duration_snapshot_minutes: number;
  applied_price_snapshot_cents: number;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  rescheduled_at: string | null;
  reschedule_count: number;
  status_reason: string | null;
  status_changed_at: string | null;
  deposit_confirmed_at: string | null;
  completed_at: string | null;
  no_show_at: string | null;
  combo_name_snapshot: string | null;
  package_charge_kind: "standard" | "package_initial" | "package_included";
  customer_package_id: string | null;
  history: Array<{
    id: number;
    previous_status: BookingStatus | null;
    next_status: BookingStatus;
    reason: string | null;
    created_at: string;
    actor: { full_name: string } | null;
  }>;
  customer: { full_name: string; phone: string; email: string | null } | null;
  treatment: { name: string } | null;
}

interface LiveAdminDashboardProps {
  adminName: string;
  canManageAccess: boolean;
  referenceTime: string;
  specialties: SpecialtyRow[];
  rules: AvailabilityRuleRow[];
  exceptions: AvailabilityExceptionRow[];
  treatments: TreatmentRow[];
  treatmentCombos: TreatmentComboRow[];
  monthlySpecials: MonthlySpecialRow[];
  bookings: AdminBookingRow[];
  agenda: {
    query: AdminAgendaQuery;
    range: AdminAgendaRange;
    total: number;
    pageSize: number;
    summary: { today: number; attention: number; confirmed: number };
  };
  feedback: Record<string, string | undefined>;
  warnings?: string[];
  supportCode?: string;
  unavailable?: Partial<Record<"bookings" | "manual" | "availability" | "exceptions" | "specialties" | "specials" | "summary", boolean>>;
}

const navItems = [
  ["resumen", "Resumen"],
  ["reservas", "Agenda"],
  ["asignar", "Asignar turno"],
  ["disponibilidad", "Horarios"],
  ["excepciones", "Bloqueos"],
  ["especialidades", "Especialidades"],
  ["especiales-mes", "Especiales del mes"],
] as const;

function bookingDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

function Feedback({ show, error, success, errorText }: { show: boolean; error?: string; success: string; errorText: string }) {
  if (show) return <p className="form-message" role="status">{success}</p>;
  if (error) return <p className="form-message form-message--error" role="alert">{errorText}</p>;
  return null;
}

export function LiveAdminDashboard({
  adminName,
  canManageAccess,
  referenceTime,
  specialties,
  rules,
  exceptions,
  treatments,
  treatmentCombos,
  monthlySpecials,
  bookings,
  agenda,
  feedback,
  warnings = [],
  supportCode,
  unavailable = {},
}: LiveAdminDashboardProps) {
  const activeModule = ["today", "agenda", "availability", "specials"].includes(feedback.module ?? "") ? feedback.module : "all";
  const show = (section: "today" | "agenda" | "availability" | "specials") => activeModule === "all" || activeModule === section;
  const [manualTreatmentId, setManualTreatmentId] = useState(treatments[0]?.id ?? "");
  const [manualComboId, setManualComboId] = useState("");
  const specialtyName = useMemo(() => new Map(specialties.map((item) => [item.id, item.name])), [specialties]);
  const treatmentName = useMemo(() => new Map(treatments.map((item) => [item.id, item.name])), [treatments]);
  const referenceTimestamp = new Date(referenceTime).getTime();
  const filteredBookings = bookings;
  const activeSpecials = monthlySpecials.filter((special) => special.is_active);
  const manualSpecials = activeSpecials.filter((special) => special.treatment_id === manualTreatmentId);
  const manualTreatment = treatments.find((treatment) => treatment.id === manualTreatmentId);
  const manualCombos = treatmentCombos.filter((combo) => combo.treatment_id === manualTreatmentId && combo.is_active);
  const defaultStart = toArgentinaDateTimeInput(new Date(referenceTimestamp + 60 * 60 * 1000).toISOString());
  const defaultEnd = toArgentinaDateTimeInput(new Date(referenceTimestamp + 2 * 60 * 60 * 1000).toISOString());
  const totalPages = Math.max(1, Math.ceil(agenda.total / agenda.pageSize));

  return (
    <div className="live-admin site-container">
      <header className="live-admin__header" id="resumen">
        <div>
          <p className="eyebrow">Administración Piel Canela</p>
          <h1>Hola, {adminName}</h1>
          <p>Agenda, disponibilidad y propuestas comerciales desde un único espacio operativo.</p>
        </div>
        <div className="live-admin__actions">
          <Link className="button button--quiet" href="/" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver sitio</Link>
          <form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form>
        </div>
      </header>

      <AdminRouteNav current={activeModule === "agenda" ? "agenda" : activeModule === "availability" ? "availability" : activeModule === "specials" ? "specials" : "operations"} canManageAccess={canManageAccess} />
      {warnings.length > 0 ? <div className="form-message form-message--error" role="alert"><p>Algunos módulos no están disponibles. No se modificó ningún dato.</p><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><p>Código de soporte: {supportCode}</p><Link className="button button--quiet" href={`/admin?module=${activeModule}`}>Reintentar consulta</Link></div> : null}

      {activeModule === "all" ? <nav className="admin-command-nav" aria-label="Secciones del panel">
        {navItems.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav> : null}

      {show("today") && !unavailable.summary ? <section className="admin-summary-grid" aria-label="Resumen operativo">
        <article><span>Turnos de hoy</span><strong className="numeric">{agenda.summary.today}</strong><small>Agenda completa del día</small></article>
        <article><span>Requieren atención</span><strong className="numeric">{agenda.summary.attention}</strong><small>Pendientes o esperando seña</small></article>
        <article><span>Confirmadas</span><strong className="numeric">{agenda.summary.confirmed}</strong><small>Próximas reservas confirmadas</small></article>
        <article><span>Especiales activos</span><strong className="numeric">{activeSpecials.length}</strong><small>Visibles según vigencia</small></article>
      </section> : null}

      {(show("today") || show("agenda")) && !unavailable.bookings ? <section className="live-admin__section admin-bookings" id="reservas" aria-labelledby="bookings-title">
        <div className="admin-section-heading">
          <div><h2 id="bookings-title">Agenda y reservas</h2><p>{agenda.range.label}. Los filtros consultan la base completa y cada página carga solo lo necesario.</p></div>
          <span className="admin-count numeric">{agenda.total} {agenda.total === 1 ? "reserva" : "reservas"}</span>
        </div>
        <Feedback show={feedback.bookingSaved === "1"} error={feedback.bookingError} success="Estado de la reserva actualizado y registrado." errorText={feedback.bookingError === "reason" ? "Indicá un motivo para cancelar o marcar una ausencia." : feedback.bookingError === "transition" ? "El estado cambió o esa transición ya no está permitida." : "No se pudo aplicar ese cambio de estado."} />
        <Feedback show={feedback.bookingDetailSaved === "1"} error={feedback.bookingDetailError} success="Notas de la reserva actualizadas." errorText="No se pudieron guardar las notas." />
        <Feedback show={feedback.rescheduleSaved === "1"} error={feedback.rescheduleError} success="Reserva reprogramada y agenda actualizada." errorText={feedback.rescheduleError === "conflict" ? "Ese horario ya está ocupado para la especialidad." : feedback.rescheduleError === "status" ? "El estado actual no permite reprogramar." : "No se pudo reprogramar la reserva."} />
        <form className="admin-agenda-filters" action="/admin#reservas" method="get">
          <input type="hidden" name="module" value="agenda" />
          <label className="admin-search"><Search aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Buscar reservas por nombre, teléfono o código</span><input name="agendaSearch" maxLength={100} defaultValue={agenda.query.search ?? ""} placeholder="Nombre, teléfono o código" /></label>
          <label>Vista<select name="agendaView" defaultValue={agenda.query.view}><option value="day">Día</option><option value="week">Semana</option><option value="all">Historial completo</option></select></label>
          <label>Fecha de referencia<input name="agendaDate" type="date" defaultValue={agenda.query.date} /></label>
          <label>Estado<select name="agendaStatus" defaultValue={agenda.query.status}><option value="all">Todos los estados</option>{Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <input type="hidden" name="agendaPage" value="1" />
          <button className="button button--quiet" type="submit">Aplicar filtros</button>
        </form>
        <div className="admin-booking-toolbar">
          {agenda.query.view !== "all" ? <nav className="admin-agenda-stepper" aria-label="Cambiar período"><Link className="button button--quiet" href={adminAgendaHref(agenda.query, { date: agenda.range.previousDate, page: 1 })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} />Anterior</Link><Link className="button button--quiet" href={adminAgendaHref(agenda.query, { date: agenda.range.nextDate, page: 1 })}>Siguiente<ChevronRight aria-hidden="true" strokeWidth={1.75} /></Link></nav> : null}
        </div>
        {filteredBookings.length === 0 ? (
          <div className="admin-empty"><CalendarDays aria-hidden="true" strokeWidth={1.75} /><h3>{agenda.total === 0 ? "No hay reservas para esta vista." : "No hay coincidencias en esta página."}</h3><p>{agenda.total === 0 ? "Probá otra fecha, vista o estado." : "Borrá la búsqueda o avanzá a otra página."}</p></div>
        ) : (
          <div className="live-booking-list">
            {filteredBookings.map((booking) => {
              const transitions = BOOKING_STATUS_TRANSITIONS[booking.status] ?? [];
              const customerName = booking.customer?.full_name ?? "Cliente";
              const treatmentName = booking.treatment?.name ?? "Tratamiento";
              const phone = booking.customer?.phone ?? "";
              const whatsappMessage = buildAdminWhatsAppMessage({
                customerName,
                bookingCode: booking.booking_code,
                treatmentName,
                startsAtLabel: bookingDate(booking.starts_at),
                startsAt: booking.starts_at,
                messageTemplates: booking.messageTemplates,
                event: booking.status === "confirmed" ? "confirmation" : "preparation",
                comboName: booking.combo_name_snapshot ?? undefined,
                durationMinutes: booking.duration_snapshot_minutes,
              });
              return <article key={booking.id} className="live-booking-row">
                <div className="live-booking-row__time numeric"><Clock3 aria-hidden="true" strokeWidth={1.75} /><time dateTime={booking.starts_at}>{bookingDate(booking.starts_at)}</time></div>
                <div className="live-booking-row__identity"><strong>{customerName}</strong><a href={`https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" strokeWidth={1.75} />{phone || "Sin teléfono"}</a></div>
                <div className="live-booking-row__treatment"><strong>{treatmentName}</strong>{booking.combo_name_snapshot ? <span>{booking.combo_name_snapshot}</span> : null}<span className="numeric">{booking.booking_code} · {booking.package_charge_kind === "package_included" ? "Incluida en paquete" : formatPrice(booking.applied_price_snapshot_cents)}</span>{booking.customer_package_id && (booking.status === "completed" || booking.status === "no_show") ? <Link className="text-link" href="/admin/paquetes">Resolver consumo de sesión</Link> : null}</div>
                <span className={`status-badge status-${booking.status}`}>{BOOKING_STATUS_LABELS[booking.status]}</span>
                {transitions.length > 0 ? <BookingStatusTransitionForm bookingId={booking.id} bookingCode={booking.booking_code} transitions={transitions} /> : <span className="booking-status-closed">Estado final</span>}
                <details className="booking-detail-disclosure" id={`booking-${booking.id}`}>
                  <summary><span><NotebookPen aria-hidden="true" strokeWidth={1.75} />Detalle operativo</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary>
                  <div className="booking-detail-disclosure__body">
                    <dl className="booking-detail-facts"><div><dt>Creada</dt><dd>{bookingDate(booking.created_at)}</dd></div><div><dt>Reprogramaciones</dt><dd className="numeric">{booking.reschedule_count}</dd></div><div><dt>Correo</dt><dd>{booking.customer?.email ?? "No informado"}</dd></div></dl>
                    {canRescheduleBooking(booking.status) ? <form action={rescheduleBooking} className="admin-form admin-form--booking-action"><input type="hidden" name="bookingId" value={booking.id} /><div><h3>Reprogramar</h3><p>La base vuelve a comprobar la capacidad de la especialidad.</p></div><label>Nueva fecha y hora<input name="startsAt" type="datetime-local" defaultValue={toArgentinaDateTimeInput(booking.starts_at)} required /></label><button className="button button--quiet" type="submit">Mover reserva</button></form> : null}
                    <form action={saveBookingNotes} className="admin-form admin-form--booking-notes"><input type="hidden" name="bookingId" value={booking.id} /><div className="admin-form-grid"><label>Nota de la persona<textarea name="customerNotes" rows={3} maxLength={240} defaultValue={booking.customer_notes ?? ""} /></label><label>Nota interna<textarea name="internalNotes" rows={3} maxLength={1000} defaultValue={booking.internal_notes ?? ""} /></label></div><div className="admin-form-footer"><p>Las notas internas no se muestran en la web ni se incluyen en WhatsApp.</p><button className="button button--quiet" type="submit">Guardar notas</button></div></form>
                    <div className="booking-status-history" aria-label={`Historial de estado de ${booking.booking_code}`}>
                      <h3>Historial de estados</h3>
                      {booking.history.length === 0 ? <p>Todavía no hay cambios de estado registrados.</p> : <ol>{booking.history.map((event) => <li key={event.id}><span className={`status-badge status-${event.next_status}`}>{BOOKING_STATUS_LABELS[event.next_status]}</span><div><strong>{event.previous_status ? `${BOOKING_STATUS_LABELS[event.previous_status]} → ${BOOKING_STATUS_LABELS[event.next_status]}` : BOOKING_STATUS_LABELS[event.next_status]}</strong><small>{bookingDate(event.created_at)} · {event.actor?.full_name ?? "Sistema"}</small>{event.reason ? <p>{event.reason}</p> : null}</div></li>)}</ol>}
                    </div>
                  </div>
                </details>
              </article>;
            })}
          </div>
        )}
        {agenda.total > agenda.pageSize ? <nav className="admin-pagination" aria-label="Páginas de reservas"><span className="numeric">Página {agenda.query.page} de {totalPages}</span><div>{agenda.query.page > 1 ? <Link className="button button--quiet" href={adminAgendaHref(agenda.query, { page: agenda.query.page - 1 })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} />Anterior</Link> : null}{agenda.query.page < totalPages ? <Link className="button button--quiet" href={adminAgendaHref(agenda.query, { page: agenda.query.page + 1 })}>Siguiente<ChevronRight aria-hidden="true" strokeWidth={1.75} /></Link> : null}</div></nav> : null}
      </section> : null}

      {show("agenda") && !unavailable.manual ? <section className="live-admin__section" id="asignar" aria-labelledby="manual-title">
        <div className="admin-section-heading"><div><h2 id="manual-title">Asignar un turno manual</h2><p>Para solicitudes recibidas por WhatsApp, teléfono o en el local. La base impide superponer una misma especialidad.</p></div><UserPlus aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.manualBookingSaved === "1"} error={feedback.manualBookingError} success="Turno manual creado y agregado a la agenda." errorText={feedback.manualBookingError === "conflict" ? "Ese horario ya está ocupado para la especialidad seleccionada." : "No se pudo crear el turno manual."} />
        <form action={createManualBooking} className="admin-form admin-form--wide">
          <div className="admin-form-grid admin-form-grid--3">
            <label>Tratamiento<select name="treatmentId" required value={manualTreatmentId} onChange={(event) => { setManualTreatmentId(event.target.value); setManualComboId(""); }}>{treatments.map((treatment) => <option key={treatment.id} value={treatment.id}>{treatment.name} · {specialtyName.get(treatment.specialty_id)}</option>)}</select></label>
            {manualTreatment?.selection_mode === "closed_combo" ? <label>Combo<select name="comboId" value={manualComboId} onChange={(event) => setManualComboId(event.target.value)} required><option value="">Seleccionar combo</option>{manualCombos.map((combo) => <option key={combo.id} value={combo.id}>{combo.name} · {combo.session_count} {combo.session_count === 1 ? "sesión" : "sesiones"} · {formatPrice(combo.fixed_price_cents)}</option>)}</select></label> : <label>Especial del mes<select name="monthlySpecialId" defaultValue=""><option value="">Sin promoción</option>{manualSpecials.map((special) => <option key={special.id} value={special.id}>{special.title}</option>)}</select></label>}
            <label>Fecha y horario<input name="startsAt" type="datetime-local" min={defaultStart.slice(0, 10) + "T00:00"} defaultValue={defaultStart} required /></label>
          </div>
          <div className="admin-form-grid admin-form-grid--3"><label>Nombre y apellido<input name="fullName" minLength={2} maxLength={100} required /></label><label>WhatsApp<input name="phone" type="tel" minLength={8} maxLength={30} required /></label><label>Correo opcional<input name="email" type="email" maxLength={180} /></label></div>
          <div className="admin-form-grid"><label>Estado inicial<select name="status" defaultValue="confirmed"><option value="pending">Pendiente</option><option value="awaiting_deposit">Esperando seña</option><option value="confirmed">Confirmada</option></select></label><label>Nota del cliente<textarea name="customerNotes" rows={3} maxLength={240} /></label><label>Nota interna<textarea name="internalNotes" rows={3} maxLength={1000} /></label></div>
          <div className="admin-form-footer"><p>La base valida la disponibilidad, los bloqueos y la capacidad de la especialidad antes de guardar.</p><button className="button button--primary" type="submit"><CheckCircle2 aria-hidden="true" strokeWidth={1.75} />Guardar turno</button></div>
        </form>
      </section> : null}

      {show("availability") && !unavailable.availability ? <section className="live-admin__section" id="disponibilidad" aria-labelledby="availability-title">
        <div className="admin-section-heading"><div><h2 id="availability-title">Disponibilidad habitual</h2><p>Elegí una especialidad y definí en qué días y franjas puede recibir turnos. La duración y la frecuencia de inicio se configuran en cada tratamiento.</p></div><CalendarClock aria-hidden="true" strokeWidth={1.75} /></div>
        <WeeklyAvailabilityEditor
          specialties={specialties}
          rules={rules}
          treatments={treatments}
          initialSpecialtyId={feedback.availabilitySpecialty}
          saved={feedback.availabilitySaved === "1"}
        />
      </section> : null}

      {show("availability") && !unavailable.exceptions ? <section className="live-admin__section" id="excepciones" aria-labelledby="exceptions-title">
        <div className="admin-section-heading"><div><h2 id="exceptions-title">Bloqueos y aperturas excepcionales</h2><p>Cerrá una franja por ausencia o habilitá un horario fuera de la rutina habitual.</p></div><PauseCircle aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.exceptionSaved === "1"} error={feedback.exceptionError} success="Excepción de agenda actualizada." errorText="No se pudo guardar esa excepción." />
        <div className="availability-admin-grid"><form action={createAvailabilityException} className="admin-form"><label>Especialidad<select name="specialtyId" required><option value="">Seleccionar</option>{specialties.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Acción<select name="kind" defaultValue="blocked"><option value="blocked">Bloquear horario</option><option value="open">Abrir horario excepcional</option></select></label><div className="admin-form-grid"><label>Desde<input name="startsAt" type="datetime-local" defaultValue={defaultStart} required /></label><label>Hasta<input name="endsAt" type="datetime-local" defaultValue={defaultEnd} required /></label></div><label>Motivo visible opcional<input name="publicReason" maxLength={180} /></label><label>Nota interna opcional<textarea name="internalReason" rows={3} maxLength={500} /></label><button className="button button--primary" type="submit">Guardar excepción</button></form><div className="availability-list"><h3>Próximas excepciones</h3>{exceptions.length === 0 ? <p className="availability-empty">No hay bloqueos ni aperturas futuras.</p> : <ul>{exceptions.map((item) => <li key={item.id}><Settings2 aria-hidden="true" strokeWidth={1.75} /><div><strong>{item.kind === "blocked" ? "Bloqueado" : "Apertura"} · {specialtyName.get(item.specialty_id)}</strong><span>{bookingDate(item.starts_at)} a {bookingDate(item.ends_at)}{item.public_reason ? ` · ${item.public_reason}` : ""}</span></div><form action={deleteAvailabilityException}><input name="id" type="hidden" value={item.id} /><button className="icon-button" type="submit" aria-label="Eliminar excepción"><Trash2 aria-hidden="true" strokeWidth={1.75} /></button></form></li>)}</ul>}</div></div>
      </section> : null}

      {show("availability") && !unavailable.specialties ? <section className="live-admin__section" id="especialidades" aria-labelledby="specialties-title">
        <div className="admin-section-heading"><div><h2 id="specialties-title">Especialidades operativas</h2><p>Controlan la capacidad simultánea. Podés crear una hoy y dejarla inactiva hasta que esté lista.</p></div><Settings2 aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.specialtySaved === "1"} error={feedback.specialtyError} success="Especialidad actualizada." errorText={feedback.specialtyError === "duplicate" ? "Ya existe una especialidad con ese nombre." : "No se pudo guardar la especialidad."} />
        <div className="availability-admin-grid"><form action={createSpecialty} className="admin-form"><h3>Nueva especialidad</h3><label>Nombre<input name="name" minLength={2} maxLength={80} required /></label><label>Descripción operativa<textarea name="description" rows={4} maxLength={500} /></label><label className="admin-check"><input type="checkbox" name="isActive" defaultChecked /><span>Disponible para configurar horarios y tratamientos</span></label><button className="button button--primary" type="submit"><Plus aria-hidden="true" strokeWidth={1.75} />Guardar especialidad</button></form><div className="specialty-list">{specialties.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.description || "Sin descripción operativa"}</span></div><span className={`status-badge ${item.is_active ? "status-confirmed" : "status-expired"}`}>{item.is_active ? "Activa" : "Futura"}</span><form action={toggleSpecialty}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="isActive" value={item.is_active ? "false" : "true"} /><button className="button button--quiet" type="submit">{item.is_active ? "Pausar" : "Activar"}</button></form></article>)}</div></div>
      </section> : null}

      {show("specials") && !unavailable.specials ? <section className="live-admin__section" id="especiales-mes" aria-labelledby="specials-title">
        <div className="admin-section-heading"><div><h2 id="specials-title">Especiales del mes</h2><p>Creá o editá las únicas propuestas concretas que aparecen destacadas en la home.</p></div><Sparkles aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.specialSaved === "1"} error={feedback.specialError} success="Especial del mes guardado y web actualizada." errorText="No se pudo guardar. Revisá fechas, precios, imagen y superposición de vigencia." />
        <details className="admin-disclosure"><summary><span><Plus aria-hidden="true" strokeWidth={1.75} />Crear especial del mes</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary><MonthlySpecialForm treatments={treatments} /></details>
        <div className="monthly-special-admin-list">{monthlySpecials.length === 0 ? <div className="admin-empty"><Sparkles aria-hidden="true" strokeWidth={1.75} /><h3>No hay especiales cargados.</h3><p>Creá el primero y definí cuándo debe mostrarse.</p></div> : monthlySpecials.map((special) => <article key={special.id} className="monthly-special-admin-item"><div className="monthly-special-admin-item__image"><Image src={special.image_url} alt={special.image_alt} fill sizes="160px" /></div><div className="monthly-special-admin-item__summary"><span className={`status-badge ${special.is_active ? "status-confirmed" : "status-expired"}`}>{special.is_active ? "Activo" : "Pausado"}</span><h3>{special.title}</h3><p>{treatmentName.get(special.treatment_id)} · {special.pricing_mode === "combo_catalog" ? "Promoción de combos" : formatPrice(special.special_price_cents)}</p><small>{bookingDate(special.starts_at)} → {bookingDate(special.ends_at)}</small></div><details className="admin-disclosure admin-disclosure--inline"><summary><span>Editar especial</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary><MonthlySpecialForm treatments={treatments} special={special} /></details></article>)}</div>
      </section> : null}
    </div>
  );
}

function MonthlySpecialForm({ treatments, special }: { treatments: TreatmentRow[]; special?: MonthlySpecialRow }) {
  const [treatmentId, setTreatmentId] = useState(special?.treatment_id ?? "");
  const selectedTreatment = treatments.find((treatment) => treatment.id === treatmentId);
  const promotesCombos = selectedTreatment?.selection_mode === "closed_combo";

  return <form action={saveMonthlySpecial} className="admin-form admin-form--special">
    {special ? <input type="hidden" name="specialId" value={special.id} /> : null}
    <div className="admin-form-grid admin-form-grid--3"><label>Tratamiento<select name="treatmentId" value={treatmentId} onChange={(event) => setTreatmentId(event.target.value)} required><option value="">Seleccionar</option>{treatments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Título<input name="title" defaultValue={special?.title ?? ""} minLength={2} maxLength={120} required /></label><label>Orden<select name="displayOrder" defaultValue={special?.display_order ?? 1}>{[1,2,3,4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <label>Descripción breve<textarea name="shortDescription" defaultValue={special?.short_description ?? ""} rows={2} minLength={10} maxLength={240} required /></label><label>Detalle completo<textarea name="detail" defaultValue={special?.detail ?? ""} rows={4} minLength={20} maxLength={1400} required /></label>
    {promotesCombos ? <>
      <input type="hidden" name="specialPricePesos" value="0" />
      <p className="admin-field-note admin-field-note--prominent">Este especial presenta los combos publicados. Cada combo conserva su propio precio y no acumula descuentos.</p>
      <label className="admin-check"><input type="checkbox" name="isActive" defaultChecked={special?.is_active ?? false} /><span>Publicar durante la vigencia</span></label>
    </> : <div className="admin-form-grid admin-form-grid--3"><label>Precio especial en pesos<input name="specialPricePesos" type="number" min="1" step="1" defaultValue={special ? special.special_price_cents / 100 : ""} required /></label><label>Precio de referencia opcional<input name="referencePricePesos" type="number" min="1" step="1" defaultValue={special?.reference_price_cents ? special.reference_price_cents / 100 : ""} /></label><label className="admin-check"><input type="checkbox" name="isActive" defaultChecked={special?.is_active ?? false} /><span>Publicar durante la vigencia</span></label></div>}
    <div className="admin-form-grid"><label>Inicio<input name="startsAt" type="datetime-local" defaultValue={special ? toArgentinaDateTimeInput(special.starts_at) : ""} required /></label><label>Fin<input name="endsAt" type="datetime-local" defaultValue={special ? toArgentinaDateTimeInput(special.ends_at) : ""} required /></label></div>
    <div className="admin-form-grid"><label>Imagen {special ? "opcional para reemplazar" : ""}<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required={!special} /></label><label>Descripción accesible<input name="imageAlt" defaultValue={special?.image_alt ?? ""} minLength={3} maxLength={240} required /></label></div><label>Condiciones opcionales<textarea name="terms" defaultValue={special?.terms ?? ""} rows={2} maxLength={500} /></label>
    <div className="admin-form-footer"><p>La home muestra entre uno y cuatro especiales activos y vigentes.</p><button className="button button--primary" type="submit">Guardar especial</button></div>
  </form>;
}
