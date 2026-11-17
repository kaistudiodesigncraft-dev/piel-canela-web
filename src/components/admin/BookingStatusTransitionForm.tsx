"use client";

import { useState } from "react";
import { updateBookingStatus } from "@/app/admin/actions";
import type { BookingStatus } from "@/domain/treatment";
import {
  BOOKING_STATUS_ACTION_LABELS,
  bookingStatusRequiresReason,
} from "@/lib/admin/operations";

export function BookingStatusTransitionForm({
  bookingId,
  bookingCode,
  transitions,
}: {
  bookingId: string;
  bookingCode: string;
  transitions: readonly BookingStatus[];
}) {
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [showCancellation, setShowCancellation] = useState(false);
  const needsReason = status ? bookingStatusRequiresReason(status) : false;
  const canCancel = transitions.includes("cancelled");
  const cancellationPanelId = `booking-cancellation-${bookingId}`;

  return (
    <div className="booking-status-actions">
      <form action={updateBookingStatus} className="booking-status-form">
        <input type="hidden" name="bookingId" value={bookingId} />
        <label>
          <span className="sr-only">Nuevo estado para {bookingCode}</span>
          <select
            name="status"
            value={status}
            required
            onChange={(event) => setStatus(event.target.value as BookingStatus | "")}
          >
            <option value="" disabled>Cambiar estado</option>
            {transitions.map((transition) => (
              <option key={transition} value={transition}>
                {BOOKING_STATUS_ACTION_LABELS[transition]}
              </option>
            ))}
          </select>
        </label>
        {needsReason ? (
          <label className="booking-status-form__reason">
            <span>Motivo</span>
            <input
              name="reason"
              minLength={3}
              maxLength={500}
              required
              placeholder={status === "cancelled" ? "Ej. avisó con anticipación" : "Ej. no se presentó"}
            />
          </label>
        ) : null}
        <button className="button button--quiet" type="submit" disabled={!status}>Aplicar</button>
      </form>

      {canCancel ? (
        <div className="booking-cancellation">
          <button
            className="button button--danger"
            type="button"
            aria-expanded={showCancellation}
            aria-controls={cancellationPanelId}
            onClick={() => setShowCancellation((current) => !current)}
          >
            Cancelar turno
          </button>
          {showCancellation ? (
            <form id={cancellationPanelId} action={updateBookingStatus} className="booking-cancellation__form">
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="status" value="cancelled" />
              <p><strong>¿Cancelar {bookingCode}?</strong> El horario se libera y la cancelación queda registrada en el historial.</p>
              <label>
                <span>Motivo de cancelación</span>
                <input name="reason" minLength={3} maxLength={500} required placeholder="Ej. la persona solicitó cancelar" autoFocus />
              </label>
              <label className="admin-check">
                <input name="confirmCancellation" type="checkbox" required />
                <span>Confirmo la cancelación de este turno.</span>
              </label>
              <div className="booking-cancellation__actions">
                <button className="button button--quiet" type="button" onClick={() => setShowCancellation(false)}>Volver</button>
                <button className="button button--danger" type="submit">Confirmar cancelación</button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
