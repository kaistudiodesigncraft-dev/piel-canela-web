"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import {
  getUniversalPackageSlots,
  scheduleUniversalPackageSession,
} from "@/app/admin/paquetes/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";

function argentinaDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: "America/Argentina/Cordoba",
  }).formatToParts(new Date(value));
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function slotTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

export function UniversalPackageSessionScheduler({
  packageId,
  expiresAt,
  referenceTime,
  bookingId = null,
}: {
  packageId: string;
  expiresAt: string;
  referenceTime: string;
  bookingId?: string | null;
}) {
  const minDate = useMemo(() => argentinaDateInput(referenceTime), [referenceTime]);
  const maxDate = useMemo(() => argentinaDateInput(expiresAt), [expiresAt]);
  const [date, setDate] = useState(minDate);
  const [startsAt, setStartsAt] = useState("");
  const [slots, setSlots] = useState<{ startsAt: string; endsAt: string }[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("loading");

  useEffect(() => {
    let active = true;
    void getUniversalPackageSlots({ packageId, date, excludedBookingId: bookingId })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setSlots(result.slots);
          setState("idle");
        } else {
          setSlots([]);
          setState("error");
        }
      })
      .catch(() => {
        if (!active) return;
        setSlots([]);
        setState("error");
      });
    return () => { active = false; };
  }, [bookingId, date, packageId]);

  return <form action={scheduleUniversalPackageSession} className="admin-form admin-form--booking-action">
    <input type="hidden" name="packageId" value={packageId} />
    <input type="hidden" name="bookingId" value={bookingId ?? ""} />
    <input type="hidden" name="action" value={bookingId ? "reschedule" : "reserve"} />
    <input type="hidden" name="startsAt" value={startsAt} />
    <div><CalendarPlus aria-hidden="true" /><h4>{bookingId ? "Reprogramar sesión" : "Asignar próxima sesión"}</h4></div>
    <label>Fecha<input type="date" min={minDate} max={maxDate} value={date} onChange={(event) => { setDate(event.target.value); setStartsAt(""); setSlots([]); setState("loading"); }} required /></label>
    <div className="admin-slot-picker" role="group" aria-label="Horarios disponibles para la sesión">
      <div className="admin-slot-picker__heading"><strong>Horarios disponibles</strong><span>Incluyen agenda, especialidad y profesional.</span></div>
      {state === "loading" ? <p className="admin-slot-picker__message" role="status">Consultando disponibilidad real...</p> : null}
      {state === "error" ? <p className="form-message form-message--error" role="alert">No pudimos consultar esta fecha.</p> : null}
      {state === "idle" && slots.length === 0 ? <p className="admin-slot-picker__message">No hay horarios disponibles.</p> : null}
      {slots.length ? <div className="admin-slot-picker__grid">{slots.map((slot) => <label key={slot.startsAt} className={`admin-slot-option${startsAt === slot.startsAt ? " is-selected" : ""}`}><input type="radio" name={`slot-${bookingId ?? "new"}`} checked={startsAt === slot.startsAt} onChange={() => setStartsAt(slot.startsAt)} /><span>{slotTime(slot.startsAt)}</span></label>)}</div> : null}
    </div>
    <AdminSubmitButton pendingLabel={bookingId ? "Reprogramando…" : "Asignando…"} disabled={!startsAt}>{bookingId ? "Confirmar nueva fecha" : "Asignar sesión"}</AdminSubmitButton>
  </form>;
}
