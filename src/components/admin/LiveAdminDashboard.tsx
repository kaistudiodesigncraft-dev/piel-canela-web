import {
  CalendarDays,
  Clock3,
  ExternalLink,
  FilePenLine,
  LogOut,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  createAvailabilityRule,
  deleteAvailabilityRule,
  signOutAdmin,
  updateBookingStatus,
} from "@/app/admin/actions";
import type { BookingStatus } from "@/domain/treatment";
import { formatPrice } from "@/lib/format";

interface SpecialtyRow {
  id: string;
  name: string;
}

interface AvailabilityRuleRow {
  id: string;
  specialty_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_interval_minutes: number;
}

interface AdminBookingRow {
  id: string;
  booking_code: string;
  status: BookingStatus;
  starts_at: string;
  duration_snapshot_minutes: number;
  applied_price_snapshot_cents: number;
  customer_notes: string | null;
  internal_notes: string | null;
  customer: { full_name: string; phone: string; email: string | null } | null;
  treatment: { name: string } | null;
}

interface LiveAdminDashboardProps {
  adminName: string;
  specialties: SpecialtyRow[];
  rules: AvailabilityRuleRow[];
  bookingCount: number;
  pendingCount: number;
  confirmedCount: number;
  bookings: AdminBookingRow[];
  availabilitySaved: boolean;
  availabilityError?: string;
  bookingSaved: boolean;
  bookingError?: string;
}

const weekdayNames = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const statusLabels: Record<BookingStatus, string> = {
  pending: "Pendiente",
  awaiting_deposit: "Esperando seña",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "No asistió",
  expired: "Vencida",
};

const nextStatuses: Record<BookingStatus, BookingStatus[]> = {
  pending: ["awaiting_deposit", "confirmed", "cancelled", "expired"],
  awaiting_deposit: ["confirmed", "cancelled", "expired"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
  expired: [],
};

function bookingDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

export function LiveAdminDashboard({
  adminName,
  specialties,
  rules,
  bookingCount,
  pendingCount,
  confirmedCount,
  bookings,
  availabilitySaved,
  availabilityError,
  bookingSaved,
  bookingError,
}: LiveAdminDashboardProps) {
  const specialtyName = new Map(specialties.map((item) => [item.id, item.name]));

  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div>
          <p className="eyebrow">Administración Piel Canela</p>
          <h1>Hola, {adminName}</h1>
          <p>Gestioná la operación sin afectar la experiencia pública.</p>
        </div>
        <div className="live-admin__actions">
          <Link className="button button--secondary" href="/admin/contenido">
            <FilePenLine aria-hidden="true" strokeWidth={1.75} />
            Editar contenido
          </Link>
          <Link className="button button--quiet" href="/" target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
            Ver sitio público
          </Link>
          <form action={signOutAdmin}>
            <button className="button button--quiet" type="submit">
              <LogOut aria-hidden="true" strokeWidth={1.75} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <section className="admin-summary-grid" aria-label="Resumen de reservas">
        <article><span>Reservas</span><strong>{bookingCount}</strong></article>
        <article><span>Pendientes</span><strong>{pendingCount}</strong></article>
        <article><span>Confirmadas</span><strong>{confirmedCount}</strong></article>
      </section>

      <section className="live-admin__section admin-bookings" id="reservas" aria-labelledby="bookings-title">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Agenda operativa</p>
            <h2 id="bookings-title">Reservas recibidas</h2>
          </div>
          <p>Las solicitudes públicas aparecen acá en cuanto se crean. Confirmá la seña o actualizá su estado.</p>
        </div>

        {bookingSaved ? <p className="form-message" role="status">Estado de la reserva actualizado.</p> : null}
        {bookingError ? <p className="form-message form-message--error" role="alert">No se pudo actualizar el estado de la reserva.</p> : null}

        {bookings.length === 0 ? (
          <div className="admin-empty admin-empty--bookings">
            <CalendarDays aria-hidden="true" strokeWidth={1.75} />
            <h3>Todavía no hay reservas.</h3>
            <p>Las nuevas pre-reservas se mostrarán automáticamente en este espacio.</p>
          </div>
        ) : (
          <div className="live-booking-list">
            {bookings.map((booking) => {
              const transitions = nextStatuses[booking.status] ?? [];
              return (
                <article key={booking.id} className="live-booking-row">
                  <div className="live-booking-row__time numeric">
                    <Clock3 aria-hidden="true" strokeWidth={1.75} />
                    <time dateTime={booking.starts_at}>{bookingDate(booking.starts_at)}</time>
                  </div>
                  <div className="live-booking-row__identity">
                    <strong>{booking.customer?.full_name ?? "Cliente"}</strong>
                    <a href={`https://wa.me/${booking.customer?.phone.replace(/\D/g, "") ?? ""}`} target="_blank" rel="noreferrer">
                      <Phone aria-hidden="true" strokeWidth={1.75} />
                      {booking.customer?.phone ?? "Sin teléfono"}
                    </a>
                  </div>
                  <div className="live-booking-row__treatment">
                    <strong>{booking.treatment?.name ?? "Tratamiento"}</strong>
                    <span className="numeric">{booking.booking_code} · {formatPrice(booking.applied_price_snapshot_cents)}</span>
                  </div>
                  <span className={`status-badge status-${booking.status}`}>{statusLabels[booking.status]}</span>
                  {transitions.length > 0 ? (
                    <form action={updateBookingStatus} className="booking-status-form">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <label>
                        <span className="sr-only">Nuevo estado para {booking.booking_code}</span>
                        <select name="status" defaultValue="" required>
                          <option value="" disabled>Cambiar estado</option>
                          {transitions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                        </select>
                      </label>
                      <button className="button button--quiet" type="submit">Aplicar</button>
                    </form>
                  ) : (
                    <span className="booking-status-closed">Estado final</span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="live-admin__section" id="disponibilidad" aria-labelledby="availability-title">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Agenda por especialidad</p>
            <h2 id="availability-title">Disponibilidad habitual</h2>
          </div>
          <p>
            Cada especialidad administra su propia capacidad. Especialidades distintas pueden atender en paralelo.
          </p>
        </div>

        {availabilitySaved ? <p className="form-message" role="status">Disponibilidad actualizada.</p> : null}
        {availabilityError ? <p className="form-message form-message--error" role="alert">No se pudo guardar el cambio.</p> : null}

        <div className="availability-admin-grid">
          <form action={createAvailabilityRule} className="availability-form">
            <h3>Agregar horario</h3>
            <label>
              Especialidad
              <select name="specialtyId" required>
                <option value="">Seleccionar</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                ))}
              </select>
            </label>
            <label>
              Día
              <select name="weekday" defaultValue="1" required>
                {weekdayNames.map((name, index) => (
                  <option key={name} value={index}>{name}</option>
                ))}
              </select>
            </label>
            <div className="availability-form__times">
              <label>Desde<input name="startTime" type="time" defaultValue="09:00" required /></label>
              <label>Hasta<input name="endTime" type="time" defaultValue="18:00" required /></label>
            </div>
            <label>
              Intervalo entre inicios
              <select name="slotIntervalMinutes" defaultValue="15">
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">60 minutos</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">
              <Plus aria-hidden="true" strokeWidth={1.75} />
              Agregar horario
            </button>
          </form>

          <div className="availability-list">
            <h3>Horarios configurados</h3>
            {rules.length === 0 ? (
              <p className="availability-empty">Todavía no hay horarios habilitados.</p>
            ) : (
              <ul>
                {rules.map((rule) => (
                  <li key={rule.id}>
                    <Clock3 aria-hidden="true" strokeWidth={1.75} />
                    <div>
                      <strong>{specialtyName.get(rule.specialty_id) ?? "Especialidad"}</strong>
                      <span>{weekdayNames[rule.weekday]} · {rule.start_time.slice(0, 5)} a {rule.end_time.slice(0, 5)}</span>
                    </div>
                    <form action={deleteAvailabilityRule}>
                      <input name="id" type="hidden" value={rule.id} />
                      <button className="icon-button" type="submit" aria-label="Eliminar horario">
                        <Trash2 aria-hidden="true" strokeWidth={1.75} />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
