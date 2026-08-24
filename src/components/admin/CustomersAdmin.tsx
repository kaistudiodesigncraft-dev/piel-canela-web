"use client";

import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Mail, MessageCircle, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { saveCustomer } from "@/app/admin/clientes/actions";
import type { BookingStatus } from "@/domain/treatment";
import { BOOKING_STATUS_LABELS } from "@/lib/admin/operations";
import { normalizePhone } from "@/lib/admin/customer-operations";
import { customerDirectoryHref, type CustomerDirectoryQuery } from "@/lib/admin/customer-directory";
import { formatPrice } from "@/lib/format";

export interface CustomerAdminBooking {
  id: string;
  customer_id: string;
  booking_code: string;
  status: BookingStatus;
  starts_at: string;
  applied_price_snapshot_cents: number;
  treatment_name_snapshot: string;
}

export interface CustomerAdminRow {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  bookings: CustomerAdminBooking[];
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

export function CustomersAdmin({ customers, referenceTime, feedback, directory }: {
  customers: CustomerAdminRow[];
  referenceTime: string;
  feedback: Record<string, string | undefined>;
  directory: CustomerDirectoryQuery & { total: number; pageSize: number };
}) {
  const now = new Date(referenceTime).getTime();
  const totalPages = Math.max(1, Math.ceil(directory.total / directory.pageSize));

  return (
    <section className="live-admin__section admin-customers" id="directorio" aria-labelledby="customers-title">
      <div className="admin-section-heading">
        <div><h2 id="customers-title">Directorio de clientes</h2><p>Buscá por nombre, teléfono o correo y abrí cada perfil para ver su recorrido completo.</p></div>
        <span className="admin-count numeric">{directory.total} {directory.total === 1 ? "perfil" : "perfiles"}</span>
      </div>
      {feedback.customerSaved === "1" ? <p className="form-message" role="status">Perfil actualizado.</p> : null}
      {feedback.customerError ? <p className="form-message form-message--error" role="alert">No se pudo actualizar el perfil.</p> : null}
      <form className="admin-booking-toolbar" action="/admin/clientes#directorio" method="get">
        <label className="admin-search"><Search aria-hidden="true" strokeWidth={1.75} /><span className="sr-only">Buscar clientes</span><input name="customerQuery" defaultValue={directory.query} maxLength={80} placeholder="Buscar nombre, teléfono o correo" /></label>
        <input type="hidden" name="customerPage" value="1" />
        <button className="button button--quiet" type="submit">Buscar</button>
        {directory.query ? <Link className="button button--quiet" href="/admin/clientes#directorio">Limpiar</Link> : null}
      </form>
      {customers.length === 0 ? (
        <div className="admin-empty"><UserRound aria-hidden="true" strokeWidth={1.75} /><h3>No encontramos clientes.</h3><p>Probá otro nombre, teléfono o correo.</p></div>
      ) : (
        <div className="admin-customer-list">
          {customers.map((customer) => {
            const upcoming = customer.bookings.find((booking) => new Date(booking.starts_at).getTime() >= now && ["pending", "awaiting_deposit", "confirmed"].includes(booking.status));
            const completedValue = customer.bookings.filter((booking) => booking.status === "completed").reduce((sum, booking) => sum + booking.applied_price_snapshot_cents, 0);
            return (
              <details className="admin-customer-item" key={customer.id} id={`customer-${customer.id}`}>
                <summary>
                  <span className="admin-professional-avatar" aria-hidden="true">{customer.full_name.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{customer.full_name}</strong><small>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</small></span>
                  <span className="admin-customer-item__metric"><strong className="numeric">{customer.bookings.length}</strong><small>{customer.bookings.length === 1 ? "reserva" : "reservas"}</small></span>
                  <span className="admin-customer-item__metric"><strong className="numeric">{formatPrice(completedValue)}</strong><small>realizado</small></span>
                  <ChevronDown aria-hidden="true" strokeWidth={1.75} />
                </summary>
                <div className="admin-customer-item__body">
                  <div className="admin-customer-contact">
                    <a className="button button--quiet" href={`https://wa.me/${normalizePhone(customer.phone)}`} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" strokeWidth={1.75} />Abrir WhatsApp</a>
                    {customer.email ? <a className="button button--quiet" href={`mailto:${customer.email}`}><Mail aria-hidden="true" strokeWidth={1.75} />Enviar correo</a> : null}
                    {upcoming ? <p><CalendarClock aria-hidden="true" strokeWidth={1.75} /><span>Próxima reserva<br /><strong>{dateLabel(upcoming.starts_at)} · {upcoming.treatment_name_snapshot}</strong></span></p> : <p>Sin reservas próximas.</p>}
                  </div>
                  <form action={saveCustomer} className="admin-form admin-form--customer">
                    <input type="hidden" name="customerId" value={customer.id} />
                    <div className="admin-form-grid admin-form-grid--3"><label>Nombre y apellido<input name="fullName" minLength={2} maxLength={100} defaultValue={customer.full_name} required /></label><label>WhatsApp<input name="phone" minLength={8} maxLength={30} defaultValue={customer.phone} required /></label><label>Correo opcional<input name="email" type="email" maxLength={180} defaultValue={customer.email ?? ""} /></label></div>
                    <label>Nota interna<small>No cargar diagnósticos ni información clínica.</small><textarea name="internalNotes" rows={3} maxLength={2000} defaultValue={customer.internal_notes ?? ""} /></label>
                    <div className="admin-form-footer"><p>Los cambios actualizan el contacto en todas sus reservas sin modificar los snapshots comerciales.</p><button className="button button--primary" type="submit">Guardar perfil</button></div>
                  </form>
                  <section className="admin-customer-history" aria-label={`Historial de ${customer.full_name}`}>
                    <h3>Historial de reservas</h3>
                    {customer.bookings.length === 0 ? <p>Todavía no tiene reservas registradas.</p> : <ul>{customer.bookings.map((booking) => <li key={booking.id}><time dateTime={booking.starts_at}>{dateLabel(booking.starts_at)}</time><span><strong>{booking.treatment_name_snapshot}</strong><small>{booking.booking_code}</small></span><span className={`status-badge status-${booking.status}`}>{BOOKING_STATUS_LABELS[booking.status]}</span><strong className="numeric">{formatPrice(booking.applied_price_snapshot_cents)}</strong></li>)}</ul>}
                  </section>
                </div>
              </details>
            );
          })}
        </div>
      )}
      {directory.total > directory.pageSize ? <nav className="admin-pagination" aria-label="Páginas de clientes"><span className="numeric">Página {directory.page} de {totalPages}</span><div>{directory.page > 1 ? <Link className="button button--quiet" href={customerDirectoryHref(directory, { page: directory.page - 1 })}><ChevronLeft aria-hidden="true" strokeWidth={1.75} />Anterior</Link> : null}{directory.page < totalPages ? <Link className="button button--quiet" href={customerDirectoryHref(directory, { page: directory.page + 1 })}>Siguiente<ChevronRight aria-hidden="true" strokeWidth={1.75} /></Link> : null}</div></nav> : null}
    </section>
  );
}
