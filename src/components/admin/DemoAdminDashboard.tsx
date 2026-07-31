"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  LayoutDashboard,
  MessageCircle,
  MoreHorizontal,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  BookingStatus,
  DemoBooking,
  MonthlySpecial,
  Treatment,
} from "@/domain/treatment";
import {
  bookingStatusMeta,
  formatBookingDate,
  formatBookingTime,
} from "@/lib/demo-bookings";
import { formatDuration, formatPrice } from "@/lib/format";

interface DemoAdminDashboardProps {
  initialBookings: readonly DemoBooking[];
  treatments: readonly Treatment[];
  monthlySpecials: readonly MonthlySpecial[];
  createdBooking?: DemoBooking;
}

type BookingFilter = "all" | BookingStatus;

const adminDates = [
  { value: "2026-07-31", label: "Hoy", detail: "Vie 31" },
  { value: "2026-08-01", label: "Mañana", detail: "Sáb 1" },
  { value: "2026-08-04", label: "Próximo", detail: "Mar 4" },
] as const;

const filterOptions: readonly { value: BookingFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "awaiting_deposit", label: "Seña pendiente" },
  { value: "confirmed", label: "Confirmadas" },
  { value: "cancelled", label: "Canceladas" },
];

export function DemoAdminDashboard({
  initialBookings,
  treatments,
  monthlySpecials,
  createdBooking,
}: DemoAdminDashboardProps) {
  const [bookings, setBookings] = useState<readonly DemoBooking[]>(() =>
    createdBooking
      ? [createdBooking, ...initialBookings.filter((item) => item.code !== createdBooking.code)]
      : initialBookings,
  );
  const [activeDate, setActiveDate] = useState<string>(
    createdBooking?.startsAt.slice(0, 10) ?? "2026-08-01",
  );
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState(
    createdBooking?.id ?? initialBookings[0]?.id ?? "",
  );

  const agendaBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.startsAt.startsWith(activeDate))
        .toSorted((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [activeDate, bookings],
  );

  const visibleBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es");
    return bookings.filter((booking) => {
      const matchesFilter = filter === "all" || booking.status === filter;
      const treatment = treatments.find((item) => item.id === booking.treatmentId);
      const matchesSearch =
        !normalizedSearch ||
        booking.customerName.toLocaleLowerCase("es").includes(normalizedSearch) ||
        booking.code.toLocaleLowerCase("es").includes(normalizedSearch) ||
        treatment?.name.toLocaleLowerCase("es").includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [bookings, filter, search, treatments]);

  const selectedBooking = bookings.find((booking) => booking.id === selectedBookingId);
  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const awaitingCount = bookings.filter(
    (booking) => booking.status === "awaiting_deposit",
  ).length;
  const confirmedToday = bookings.filter(
    (booking) => booking.startsAt.startsWith(activeDate) && booking.status === "confirmed",
  ).length;

  function treatmentFor(booking: DemoBooking) {
    return treatments.find((item) => item.id === booking.treatmentId);
  }

  function updateStatus(bookingId: string, status: BookingStatus) {
    setBookings((current) =>
      current.map((booking) =>
        booking.id === bookingId ? { ...booking, status } : booking,
      ),
    );
  }

  return (
    <div className="admin-demo">
      <aside className="admin-sidebar">
        <div>
          <p className="admin-sidebar__brand">Piel Canela</p>
          <p className="admin-sidebar__caption">Panel demostrativo</p>
        </div>
        <nav aria-label="Secciones del panel">
          <a className="is-active" href="#resumen">
            <LayoutDashboard aria-hidden="true" strokeWidth={1.75} />
            Resumen
          </a>
          <a href="#agenda">
            <CalendarDays aria-hidden="true" strokeWidth={1.75} />
            Agenda
          </a>
          <a href="#reservas">
            <UsersRound aria-hidden="true" strokeWidth={1.75} />
            Reservas
          </a>
          <a href="#tratamientos-admin">
            <Sparkles aria-hidden="true" strokeWidth={1.75} />
            Tratamientos
          </a>
        </nav>
        <div className="admin-sidebar__note">
          <strong>Demo sin persistencia</strong>
          <p>Los cambios vuelven a su estado inicial al recargar.</p>
        </div>
        <Link className="admin-sidebar__exit" href="/">
          Ver sitio público
          <ArrowUpRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">Operación diaria</p>
            <h1>Todo lo importante, a mano.</h1>
          </div>
          <div className="demo-badge demo-badge--admin">
            <Sparkles aria-hidden="true" strokeWidth={1.75} />
            Datos simulados
          </div>
        </header>

        {createdBooking ? (
          <div className="admin-created-notice" role="status">
            <Check aria-hidden="true" strokeWidth={1.75} />
            <div>
              <strong>La reserva {createdBooking.code} llegó al panel.</strong>
              <p>Aparece como pendiente, igual que ocurriría antes de verificar la seña.</p>
            </div>
            <a href="#reservas">Ver reserva</a>
          </div>
        ) : null}

        <section className="admin-summary" id="resumen" aria-label="Resumen operativo">
          <div>
            <span>Agenda del día</span>
            <strong className="numeric">{agendaBookings.length}</strong>
            <small>turnos visibles</small>
          </div>
          <div>
            <span>Pendientes</span>
            <strong className="numeric">{pendingCount}</strong>
            <small>requieren contacto</small>
          </div>
          <div>
            <span>Esperando seña</span>
            <strong className="numeric">{awaitingCount}</strong>
            <small>para confirmar</small>
          </div>
          <div>
            <span>Confirmados</span>
            <strong className="numeric">{confirmedToday}</strong>
            <small>en el día elegido</small>
          </div>
        </section>

        <section className="admin-section" id="agenda" aria-labelledby="agenda-title">
          <div className="admin-section__heading">
            <div>
              <p className="eyebrow">Agenda</p>
              <h2 id="agenda-title">El ritmo del día.</h2>
            </div>
            <Link className="button button--primary" href="/tratamientos#catalogo">
              Crear reserva simulada
            </Link>
          </div>

          <div className="admin-date-switcher" aria-label="Elegir día de agenda">
            {adminDates.map((date) => (
              <button
                key={date.value}
                type="button"
                className={activeDate === date.value ? "is-active" : ""}
                aria-pressed={activeDate === date.value}
                onClick={() => setActiveDate(date.value)}
              >
                <span>{date.label}</span>
                <strong>{date.detail}</strong>
              </button>
            ))}
          </div>

          <div className="admin-agenda-layout">
            <div className="agenda-rail">
              {agendaBookings.length > 0 ? (
                agendaBookings.map((booking) => {
                  const treatment = treatmentFor(booking);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      className={`agenda-entry status-${booking.status}${booking.id === selectedBookingId ? " is-selected" : ""}`}
                      onClick={() => setSelectedBookingId(booking.id)}
                    >
                      <time className="numeric" dateTime={booking.startsAt}>
                        {formatBookingTime(booking.startsAt)}
                      </time>
                      <span className="agenda-entry__line" aria-hidden="true" />
                      <span className="agenda-entry__content">
                        <strong>{treatment?.name ?? "Tratamiento"}</strong>
                        <small>{booking.customerName} · {formatDuration(booking.durationMinutes)}</small>
                      </span>
                      <StatusBadge status={booking.status} />
                      <ChevronRight aria-hidden="true" strokeWidth={1.75} />
                    </button>
                  );
                })
              ) : (
                <div className="admin-empty">
                  <CalendarDays aria-hidden="true" strokeWidth={1.75} />
                  <h3>No hay turnos para este día</h3>
                  <p>Elegí otra fecha o creá una reserva simulada desde el catálogo.</p>
                </div>
              )}
            </div>

            <BookingInspector
              booking={selectedBooking}
              treatment={selectedBooking ? treatmentFor(selectedBooking) : undefined}
              special={monthlySpecials.find(
                (item) => item.id === selectedBooking?.monthlySpecialId,
              )}
              onStatusChange={(status) => {
                if (selectedBooking) updateStatus(selectedBooking.id, status);
              }}
            />
          </div>
        </section>

        <section className="admin-section" id="reservas" aria-labelledby="reservations-title">
          <div className="admin-section__heading admin-section__heading--compact">
            <div>
              <p className="eyebrow">Reservas</p>
              <h2 id="reservations-title">Seguimiento sin perder conversaciones.</h2>
            </div>
            <label className="admin-search">
              <Search aria-hidden="true" strokeWidth={1.75} />
              <span className="sr-only">Buscar reservas</span>
              <input
                type="search"
                placeholder="Buscar persona, código o tratamiento"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="admin-filters" aria-label="Filtrar reservas por estado">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={filter === option.value ? "is-active" : ""}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="reservation-list" role="region" aria-label="Listado de reservas">
            {visibleBookings.map((booking) => {
              const treatment = treatmentFor(booking);
              return (
                <button
                  key={booking.id}
                  className={`reservation-row${booking.isNew ? " is-new" : ""}`}
                  type="button"
                  onClick={() => setSelectedBookingId(booking.id)}
                >
                  <span className="reservation-row__date">
                    <strong>{formatBookingTime(booking.startsAt)}</strong>
                    <small>{formatBookingDate(booking.startsAt)}</small>
                  </span>
                  <span className="reservation-row__person">
                    <strong>{booking.customerName}</strong>
                    <small>{booking.code}</small>
                  </span>
                  <span className="reservation-row__treatment">
                    <strong>{treatment?.name ?? "Tratamiento"}</strong>
                    <small>{formatPrice(booking.priceCents)}</small>
                  </span>
                  <StatusBadge status={booking.status} />
                  <MoreHorizontal aria-hidden="true" strokeWidth={1.75} />
                </button>
              );
            })}
            {visibleBookings.length === 0 ? (
              <div className="admin-empty admin-empty--list">
                <Search aria-hidden="true" strokeWidth={1.75} />
                <h3>No encontramos reservas</h3>
                <p>Cambiá el filtro o probá con otro término.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="admin-section" id="tratamientos-admin" aria-labelledby="admin-treatments-title">
          <div className="admin-section__heading admin-section__heading--compact">
            <div>
              <p className="eyebrow">Tratamientos</p>
              <h2 id="admin-treatments-title">Contenido que Piel Canela podrá administrar.</h2>
            </div>
            <span className="admin-count numeric">{treatments.filter((item) => item.isActive).length} activos</span>
          </div>
          <div className="admin-treatment-list">
            {treatments.filter((item) => item.isActive).map((treatment) => {
              const special = monthlySpecials.find(
                (item) => item.treatmentId === treatment.id && item.isActive,
              );
              return (
                <div key={treatment.id}>
                  <span className="admin-treatment-list__mark" aria-hidden="true" />
                  <span>
                    <strong>{treatment.name}</strong>
                    <small>{formatDuration(treatment.durationMinutes)}</small>
                  </span>
                  {special ? <span className="admin-special-label">Especial activo</span> : null}
                  <strong className="numeric">{formatPrice(treatment.priceCents)}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      {bookingStatusMeta[status].shortLabel}
    </span>
  );
}

interface BookingInspectorProps {
  booking?: DemoBooking;
  treatment?: Treatment;
  special?: MonthlySpecial;
  onStatusChange: (status: BookingStatus) => void;
}

function BookingInspector({
  booking,
  treatment,
  special,
  onStatusChange,
}: BookingInspectorProps) {
  if (!booking) {
    return (
      <aside className="booking-inspector booking-inspector--empty">
        <UserRound aria-hidden="true" strokeWidth={1.75} />
        <p>Seleccioná una reserva para ver su detalle.</p>
      </aside>
    );
  }

  return (
    <aside className="booking-inspector" aria-label={`Detalle de ${booking.customerName}`}>
      <div className="booking-inspector__header">
        <div>
          <span className="numeric">{booking.code}</span>
          <h3>{booking.customerName}</h3>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <dl className="booking-inspector__facts numeric">
        <div>
          <dt>Tratamiento</dt>
          <dd>{special?.title ?? treatment?.name ?? "Tratamiento"}</dd>
        </div>
        <div>
          <dt>Fecha y horario</dt>
          <dd>{formatBookingDate(booking.startsAt)} · {formatBookingTime(booking.startsAt)}</dd>
        </div>
        <div>
          <dt>Valor</dt>
          <dd>{formatPrice(booking.priceCents)}</dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{booking.phone}</dd>
        </div>
      </dl>

      {booking.customerNotes ? (
        <div className="booking-inspector__notes">
          <span>Nota de la persona</span>
          <p>{booking.customerNotes}</p>
        </div>
      ) : null}

      <div className="booking-inspector__actions">
        {booking.status !== "confirmed" ? (
          <button className="button button--primary" type="button" onClick={() => onStatusChange("confirmed")}>
            <Check aria-hidden="true" strokeWidth={1.75} />
            Confirmar seña
          </button>
        ) : (
          <button className="button button--secondary" type="button" onClick={() => onStatusChange("completed")}>
            Marcar realizado
          </button>
        )}
        <button className="button button--quiet" type="button">
          <MessageCircle aria-hidden="true" strokeWidth={1.75} />
          Abrir WhatsApp
        </button>
        {booking.status !== "cancelled" ? (
          <button className="admin-danger-action" type="button" onClick={() => onStatusChange("cancelled")}>
            <X aria-hidden="true" strokeWidth={1.75} />
            Cancelar turno
          </button>
        ) : null}
      </div>
    </aside>
  );
}
