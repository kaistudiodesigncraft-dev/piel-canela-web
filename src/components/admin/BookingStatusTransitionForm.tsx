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
  const needsReason = status ? bookingStatusRequiresReason(status) : false;

  return (
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
  );
}
