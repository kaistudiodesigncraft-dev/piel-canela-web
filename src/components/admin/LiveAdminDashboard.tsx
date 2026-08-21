"use client";

import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
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
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import {
  createAvailabilityException,
  createAvailabilityRule,
  createManualBooking,
  createSpecialty,
  deleteAvailabilityException,
  deleteAvailabilityRule,
  saveMonthlySpecial,
  signOutAdmin,
  toggleSpecialty,
  updateBookingStatus,
} from "@/app/admin/actions";
import type { BookingStatus } from "@/domain/treatment";
import {
  bookingSearchText,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_TRANSITIONS,
  toArgentinaDateTimeInput,
} from "@/lib/admin/operations";
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
  slot_interval_minutes: number;
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
  price_cents: number;
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
  special_price_cents: number;
  reference_price_cents: number | null;
  starts_at: string;
  ends_at: string;
  terms: string | null;
  is_active: boolean;
  display_order: number;
}

interface AdminBookingRow {
  id: string;
  booking_code: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  duration_snapshot_minutes: number;
  applied_price_snapshot_cents: number;
  customer_notes: string | null;
  internal_notes: string | null;
  customer: { full_name: string; phone: string; email: string | null } | null;
  treatment: { name: string } | null;
}

interface LiveAdminDashboardProps {
  adminName: string;
  referenceTime: string;
  specialties: SpecialtyRow[];
  rules: AvailabilityRuleRow[];
  exceptions: AvailabilityExceptionRow[];
  treatments: TreatmentRow[];
  monthlySpecials: MonthlySpecialRow[];
  bookings: AdminBookingRow[];
  feedback: Record<string, string | undefined>;
}

const weekdayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
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

function dayKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Argentina/Cordoba",
  }).format(date);
}

function Feedback({ show, error, success, errorText }: { show: boolean; error?: string; success: string; errorText: string }) {
  if (show) return <p className="form-message" role="status">{success}</p>;
  if (error) return <p className="form-message form-message--error" role="alert">{errorText}</p>;
  return null;
}

export function LiveAdminDashboard({
  adminName,
  referenceTime,
  specialties,
  rules,
  exceptions,
  treatments,
  monthlySpecials,
  bookings,
  feedback,
}: LiveAdminDashboardProps) {
  const [bookingQuery, setBookingQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [agendaRange, setAgendaRange] = useState<"today" | "upcoming" | "all">("today");
  const [manualTreatmentId, setManualTreatmentId] = useState(treatments[0]?.id ?? "");
  const specialtyName = useMemo(() => new Map(specialties.map((item) => [item.id, item.name])), [specialties]);
  const treatmentName = useMemo(() => new Map(treatments.map((item) => [item.id, item.name])), [treatments]);
  const referenceTimestamp = new Date(referenceTime).getTime();
  const today = dayKey(referenceTime);
  const upcomingLimit = referenceTimestamp + 7 * 24 * 60 * 60 * 1000;
  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    if (statusFilter !== "all" && booking.status !== statusFilter) return false;
    const startsAt = new Date(booking.starts_at);
    if (agendaRange === "today" && dayKey(startsAt) !== today) return false;
    if (agendaRange === "upcoming" && (startsAt.getTime() < referenceTimestamp || startsAt.getTime() > upcomingLimit)) return false;
    const query = bookingQuery.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!query) return true;
    return bookingSearchText({
      code: booking.booking_code,
      customerName: booking.customer?.full_name ?? "",
      phone: booking.customer?.phone ?? "",
      treatmentName: booking.treatment?.name ?? "",
    }).includes(query);
  }), [agendaRange, bookingQuery, bookings, referenceTimestamp, statusFilter, today, upcomingLimit]);
  const todayBookings = bookings.filter((booking) => dayKey(booking.starts_at) === today);
  const pendingCount = bookings.filter((booking) => booking.status === "pending" || booking.status === "awaiting_deposit").length;
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const activeSpecials = monthlySpecials.filter((special) => special.is_active);
  const manualSpecials = activeSpecials.filter((special) => special.treatment_id === manualTreatmentId);
  const defaultStart = toArgentinaDateTimeInput(new Date(referenceTimestamp + 60 * 60 * 1000).toISOString());
  const defaultEnd = toArgentinaDateTimeInput(new Date(referenceTimestamp + 2 * 60 * 60 * 1000).toISOString());

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

      <AdminRouteNav current="operations" />

      <nav className="admin-command-nav" aria-label="Secciones del panel">
        {navItems.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
      </nav>

      <section className="admin-summary-grid" aria-label="Resumen operativo">
        <article><span>Turnos de hoy</span><strong className="numeric">{todayBookings.length}</strong><small>Agenda del día</small></article>
        <article><span>Requieren atención</span><strong className="numeric">{pendingCount}</strong><small>Pendientes o esperando seña</small></article>
        <article><span>Confirmadas</span><strong className="numeric">{confirmedCount}</strong><small>Próximas reservas confirmadas</small></article>
        <article><span>Especiales activos</span><strong className="numeric">{activeSpecials.length}</strong><small>Visibles según vigencia</small></article>
      </section>

      <section className="live-admin__section admin-bookings" id="reservas" aria-labelledby="bookings-title">
        <div className="admin-section-heading">
          <div><h2 id="bookings-title">Agenda y reservas</h2><p>Buscá una solicitud, filtrá por estado y resolvé la operación desde la misma fila.</p></div>
          <span className="admin-count numeric">{filteredBookings.length} resultados</span>
        </div>
        <Feedback show={feedback.bookingSaved === "1"} error={feedback.bookingError} success="Estado de la reserva actualizado." errorText="No se pudo aplicar ese cambio de estado." />
        <div className="admin-booking-toolbar">
          <label className="admin-search"><Search aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Buscar reservas</span><input value={bookingQuery} onChange={(event) => setBookingQuery(event.target.value)} placeholder="Buscar persona, código o tratamiento" /></label>
          <label><span className="sr-only">Filtrar por estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as BookingStatus | "all")}><option value="all">Todos los estados</option>{Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="admin-segmented" aria-label="Rango de agenda">{([['today','Hoy'],['upcoming','Próximos 7 días'],['all','Todo']] as const).map(([value,label]) => <button key={value} type="button" className={agendaRange === value ? "is-active" : ""} onClick={() => setAgendaRange(value)}>{label}</button>)}</div>
        </div>
        {filteredBookings.length === 0 ? (
          <div className="admin-empty"><CalendarDays aria-hidden="true" strokeWidth={1.75} /><h3>No hay reservas para esta vista.</h3><p>Probá otro rango, estado o término de búsqueda.</p></div>
        ) : (
          <div className="live-booking-list">
            {filteredBookings.map((booking) => {
              const transitions = BOOKING_STATUS_TRANSITIONS[booking.status] ?? [];
              return <article key={booking.id} className="live-booking-row">
                <div className="live-booking-row__time numeric"><Clock3 aria-hidden="true" strokeWidth={1.75} /><time dateTime={booking.starts_at}>{bookingDate(booking.starts_at)}</time></div>
                <div className="live-booking-row__identity"><strong>{booking.customer?.full_name ?? "Cliente"}</strong><a href={`https://wa.me/${booking.customer?.phone.replace(/\D/g, "") ?? ""}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" strokeWidth={1.75} />{booking.customer?.phone ?? "Sin teléfono"}</a></div>
                <div className="live-booking-row__treatment"><strong>{booking.treatment?.name ?? "Tratamiento"}</strong><span className="numeric">{booking.booking_code} · {formatPrice(booking.applied_price_snapshot_cents)}</span></div>
                <span className={`status-badge status-${booking.status}`}>{BOOKING_STATUS_LABELS[booking.status]}</span>
                {transitions.length > 0 ? <form action={updateBookingStatus} className="booking-status-form"><input type="hidden" name="bookingId" value={booking.id} /><label><span className="sr-only">Nuevo estado para {booking.booking_code}</span><select name="status" defaultValue="" required><option value="" disabled>Cambiar estado</option>{transitions.map((status) => <option key={status} value={status}>{BOOKING_STATUS_LABELS[status]}</option>)}</select></label><button className="button button--quiet" type="submit">Aplicar</button></form> : <span className="booking-status-closed">Estado final</span>}
              </article>;
            })}
          </div>
        )}
      </section>

      <section className="live-admin__section" id="asignar" aria-labelledby="manual-title">
        <div className="admin-section-heading"><div><h2 id="manual-title">Asignar un turno manual</h2><p>Para solicitudes recibidas por WhatsApp, teléfono o en el local. La base impide superponer una misma especialidad.</p></div><UserPlus aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.manualBookingSaved === "1"} error={feedback.manualBookingError} success="Turno manual creado y agregado a la agenda." errorText={feedback.manualBookingError === "conflict" ? "Ese horario ya está ocupado para la especialidad seleccionada." : "No se pudo crear el turno manual."} />
        <form action={createManualBooking} className="admin-form admin-form--wide">
          <div className="admin-form-grid admin-form-grid--3">
            <label>Tratamiento<select name="treatmentId" required value={manualTreatmentId} onChange={(event) => setManualTreatmentId(event.target.value)}>{treatments.map((treatment) => <option key={treatment.id} value={treatment.id}>{treatment.name} · {specialtyName.get(treatment.specialty_id)}</option>)}</select></label>
            <label>Especial del mes<select name="monthlySpecialId" defaultValue=""><option value="">Sin promoción</option>{manualSpecials.map((special) => <option key={special.id} value={special.id}>{special.title}</option>)}</select></label>
            <label>Fecha y horario<input name="startsAt" type="datetime-local" min={defaultStart.slice(0, 10) + "T00:00"} defaultValue={defaultStart} required /></label>
          </div>
          <div className="admin-form-grid admin-form-grid--3"><label>Nombre y apellido<input name="fullName" minLength={2} maxLength={100} required /></label><label>WhatsApp<input name="phone" type="tel" minLength={8} maxLength={30} required /></label><label>Correo opcional<input name="email" type="email" maxLength={180} /></label></div>
          <div className="admin-form-grid"><label>Estado inicial<select name="status" defaultValue="confirmed"><option value="pending">Pendiente</option><option value="awaiting_deposit">Esperando seña</option><option value="confirmed">Confirmada</option></select></label><label>Nota del cliente<textarea name="customerNotes" rows={3} maxLength={240} /></label><label>Nota interna<textarea name="internalNotes" rows={3} maxLength={1000} /></label></div>
          <div className="admin-form-footer"><p>El horario puede ser excepcional; solo se rechaza si ya existe otro turno de la misma especialidad.</p><button className="button button--primary" type="submit"><CheckCircle2 aria-hidden="true" strokeWidth={1.75} />Guardar turno</button></div>
        </form>
      </section>

      <section className="live-admin__section" id="disponibilidad" aria-labelledby="availability-title">
        <div className="admin-section-heading"><div><h2 id="availability-title">Disponibilidad habitual</h2><p>Definí las ventanas que alimentan el calendario público para cada especialidad.</p></div><CalendarClock aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.availabilitySaved === "1"} error={feedback.availabilityError} success="Disponibilidad actualizada." errorText={feedback.availabilityError === "duplicate" ? "Ese horario ya está configurado." : "No se pudo guardar el horario."} />
        <div className="availability-admin-grid">
          <form action={createAvailabilityRule} className="admin-form"><h3>Agregar horario</h3><label>Especialidad<select name="specialtyId" required><option value="">Seleccionar</option>{specialties.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Día<select name="weekday" defaultValue="1" required>{weekdayNames.map((name,index) => <option key={name} value={index}>{name}</option>)}</select></label><div className="admin-form-grid"><label>Desde<input name="startTime" type="time" defaultValue="09:00" required /></label><label>Hasta<input name="endTime" type="time" defaultValue="18:00" required /></label></div><label>Intervalo entre inicios<select name="slotIntervalMinutes" defaultValue="15"><option value="15">15 minutos</option><option value="30">30 minutos</option><option value="60">60 minutos</option></select></label><button className="button button--primary" type="submit"><Plus aria-hidden="true" strokeWidth={1.75} />Agregar horario</button></form>
          <div className="availability-list"><h3>Horarios configurados</h3>{rules.length === 0 ? <p className="availability-empty">Todavía no hay horarios habilitados.</p> : <ul>{rules.map((rule) => <li key={rule.id}><Clock3 aria-hidden="true" strokeWidth={1.75} /><div><strong>{specialtyName.get(rule.specialty_id) ?? "Especialidad"}</strong><span>{weekdayNames[rule.weekday]} · {rule.start_time.slice(0,5)} a {rule.end_time.slice(0,5)} · cada {rule.slot_interval_minutes} min</span></div><form action={deleteAvailabilityRule}><input name="id" type="hidden" value={rule.id} /><button className="icon-button" type="submit" aria-label={`Desactivar horario de ${specialtyName.get(rule.specialty_id)}`}><Trash2 aria-hidden="true" strokeWidth={1.75} /></button></form></li>)}</ul>}</div>
        </div>
      </section>

      <section className="live-admin__section" id="excepciones" aria-labelledby="exceptions-title">
        <div className="admin-section-heading"><div><h2 id="exceptions-title">Bloqueos y aperturas excepcionales</h2><p>Cerrá una franja por ausencia o habilitá un horario fuera de la rutina habitual.</p></div><PauseCircle aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.exceptionSaved === "1"} error={feedback.exceptionError} success="Excepción de agenda actualizada." errorText="No se pudo guardar esa excepción." />
        <div className="availability-admin-grid"><form action={createAvailabilityException} className="admin-form"><label>Especialidad<select name="specialtyId" required><option value="">Seleccionar</option>{specialties.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Acción<select name="kind" defaultValue="blocked"><option value="blocked">Bloquear horario</option><option value="open">Abrir horario excepcional</option></select></label><div className="admin-form-grid"><label>Desde<input name="startsAt" type="datetime-local" defaultValue={defaultStart} required /></label><label>Hasta<input name="endsAt" type="datetime-local" defaultValue={defaultEnd} required /></label></div><label>Motivo visible opcional<input name="publicReason" maxLength={180} /></label><label>Nota interna opcional<textarea name="internalReason" rows={3} maxLength={500} /></label><button className="button button--primary" type="submit">Guardar excepción</button></form><div className="availability-list"><h3>Próximas excepciones</h3>{exceptions.length === 0 ? <p className="availability-empty">No hay bloqueos ni aperturas futuras.</p> : <ul>{exceptions.map((item) => <li key={item.id}><Settings2 aria-hidden="true" strokeWidth={1.75} /><div><strong>{item.kind === "blocked" ? "Bloqueado" : "Apertura"} · {specialtyName.get(item.specialty_id)}</strong><span>{bookingDate(item.starts_at)} a {bookingDate(item.ends_at)}{item.public_reason ? ` · ${item.public_reason}` : ""}</span></div><form action={deleteAvailabilityException}><input name="id" type="hidden" value={item.id} /><button className="icon-button" type="submit" aria-label="Eliminar excepción"><Trash2 aria-hidden="true" strokeWidth={1.75} /></button></form></li>)}</ul>}</div></div>
      </section>

      <section className="live-admin__section" id="especialidades" aria-labelledby="specialties-title">
        <div className="admin-section-heading"><div><h2 id="specialties-title">Especialidades operativas</h2><p>Controlan la capacidad simultánea. Podés crear una hoy y dejarla inactiva hasta que esté lista.</p></div><Settings2 aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.specialtySaved === "1"} error={feedback.specialtyError} success="Especialidad actualizada." errorText={feedback.specialtyError === "duplicate" ? "Ya existe una especialidad con ese nombre." : "No se pudo guardar la especialidad."} />
        <div className="availability-admin-grid"><form action={createSpecialty} className="admin-form"><h3>Nueva especialidad</h3><label>Nombre<input name="name" minLength={2} maxLength={80} required /></label><label>Descripción operativa<textarea name="description" rows={4} maxLength={500} /></label><label className="admin-check"><input type="checkbox" name="isActive" defaultChecked /><span>Disponible para configurar horarios y tratamientos</span></label><button className="button button--primary" type="submit"><Plus aria-hidden="true" strokeWidth={1.75} />Guardar especialidad</button></form><div className="specialty-list">{specialties.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{item.description || "Sin descripción operativa"}</span></div><span className={`status-badge ${item.is_active ? "status-confirmed" : "status-expired"}`}>{item.is_active ? "Activa" : "Futura"}</span><form action={toggleSpecialty}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="isActive" value={item.is_active ? "false" : "true"} /><button className="button button--quiet" type="submit">{item.is_active ? "Pausar" : "Activar"}</button></form></article>)}</div></div>
      </section>

      <section className="live-admin__section" id="especiales-mes" aria-labelledby="specials-title">
        <div className="admin-section-heading"><div><h2 id="specials-title">Especiales del mes</h2><p>Creá o editá las únicas propuestas concretas que aparecen destacadas en la home.</p></div><Sparkles aria-hidden="true" strokeWidth={1.75} /></div>
        <Feedback show={feedback.specialSaved === "1"} error={feedback.specialError} success="Especial del mes guardado y web actualizada." errorText="No se pudo guardar. Revisá fechas, precios, imagen y superposición de vigencia." />
        <details className="admin-disclosure"><summary><span><Plus aria-hidden="true" strokeWidth={1.75} />Crear especial del mes</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary><MonthlySpecialForm treatments={treatments} /></details>
        <div className="monthly-special-admin-list">{monthlySpecials.length === 0 ? <div className="admin-empty"><Sparkles aria-hidden="true" strokeWidth={1.75} /><h3>No hay especiales cargados.</h3><p>Creá el primero y definí cuándo debe mostrarse.</p></div> : monthlySpecials.map((special) => <article key={special.id} className="monthly-special-admin-item"><div className="monthly-special-admin-item__image"><Image src={special.image_url} alt={special.image_alt} fill sizes="160px" /></div><div className="monthly-special-admin-item__summary"><span className={`status-badge ${special.is_active ? "status-confirmed" : "status-expired"}`}>{special.is_active ? "Activo" : "Pausado"}</span><h3>{special.title}</h3><p>{treatmentName.get(special.treatment_id)} · {formatPrice(special.special_price_cents)}</p><small>{bookingDate(special.starts_at)} → {bookingDate(special.ends_at)}</small></div><details className="admin-disclosure admin-disclosure--inline"><summary><span>Editar especial</span><ChevronDown aria-hidden="true" strokeWidth={1.75} /></summary><MonthlySpecialForm treatments={treatments} special={special} /></details></article>)}</div>
      </section>
    </div>
  );
}

function MonthlySpecialForm({ treatments, special }: { treatments: TreatmentRow[]; special?: MonthlySpecialRow }) {
  return <form action={saveMonthlySpecial} className="admin-form admin-form--special">
    {special ? <input type="hidden" name="specialId" value={special.id} /> : null}
    <div className="admin-form-grid admin-form-grid--3"><label>Tratamiento<select name="treatmentId" defaultValue={special?.treatment_id ?? ""} required><option value="">Seleccionar</option>{treatments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Título<input name="title" defaultValue={special?.title ?? ""} minLength={2} maxLength={120} required /></label><label>Orden<select name="displayOrder" defaultValue={special?.display_order ?? 1}>{[1,2,3,4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
    <label>Descripción breve<textarea name="shortDescription" defaultValue={special?.short_description ?? ""} rows={2} minLength={10} maxLength={240} required /></label><label>Detalle completo<textarea name="detail" defaultValue={special?.detail ?? ""} rows={4} minLength={20} maxLength={1400} required /></label>
    <div className="admin-form-grid admin-form-grid--3"><label>Precio especial en pesos<input name="specialPricePesos" type="number" min="1" step="1" defaultValue={special ? special.special_price_cents / 100 : ""} required /></label><label>Precio de referencia opcional<input name="referencePricePesos" type="number" min="1" step="1" defaultValue={special?.reference_price_cents ? special.reference_price_cents / 100 : ""} /></label><label className="admin-check"><input type="checkbox" name="isActive" defaultChecked={special?.is_active ?? false} /><span>Publicar durante la vigencia</span></label></div>
    <div className="admin-form-grid"><label>Inicio<input name="startsAt" type="datetime-local" defaultValue={special ? toArgentinaDateTimeInput(special.starts_at) : ""} required /></label><label>Fin<input name="endsAt" type="datetime-local" defaultValue={special ? toArgentinaDateTimeInput(special.ends_at) : ""} required /></label></div>
    <div className="admin-form-grid"><label>Imagen {special ? "opcional para reemplazar" : ""}<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required={!special} /></label><label>Descripción accesible<input name="imageAlt" defaultValue={special?.image_alt ?? ""} minLength={3} maxLength={240} required /></label></div><label>Condiciones opcionales<textarea name="terms" defaultValue={special?.terms ?? ""} rows={2} maxLength={500} /></label>
    <div className="admin-form-footer"><p>La home muestra entre uno y cuatro especiales activos y vigentes.</p><button className="button button--primary" type="submit">Guardar especial</button></div>
  </form>;
}
