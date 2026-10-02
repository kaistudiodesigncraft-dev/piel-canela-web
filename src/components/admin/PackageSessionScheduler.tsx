"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { getPackageSessionSlots, schedulePackageSession } from "@/app/admin/paquetes/actions";
import { AdminSubmitButton } from "@/components/admin/AdminSubmitButton";
import { idempotencyUuid } from "@/lib/idempotency";

function slotTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(value));
}

function argentinaDateInput(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Argentina/Cordoba",
  }).formatToParts(new Date(value));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function PackageSessionScheduler({
  packageId,
  expiresAt,
  referenceTime,
}: {
  packageId: string;
  expiresAt: string;
  referenceTime: string;
}) {
  const minDate = useMemo(() => argentinaDateInput(referenceTime), [referenceTime]);
  const maxDate = useMemo(() => argentinaDateInput(expiresAt), [expiresAt]);
  const [date, setDate] = useState(minDate);
  const [startsAt, setStartsAt] = useState("");
  const [slots, setSlots] = useState<{ startsAt: string; endsAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const idempotencyKey = idempotencyUuid(useId());

  useEffect(() => {
    let active = true;
    if (!date) return () => { active = false; };
    void (async () => {
      setLoading(true);
      setError(false);
      setSlots([]);
      const result = await getPackageSessionSlots({ packageId, date });
      if (!active) return;
      if (result.ok) {
        setSlots(result.slots);
      } else {
        setError(true);
      }
      setLoading(false);
    })().catch(() => {
      if (!active) return;
      setError(true);
      setLoading(false);
    });
    return () => { active = false; };
  }, [date, packageId]);

  return (
    <form action={schedulePackageSession} className="admin-form admin-form--booking-action">
      <input type="hidden" name="packageId" value={packageId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="startsAt" value={startsAt} />
      <div><CalendarPlus aria-hidden="true" /><h4>Asignar próxima sesión</h4></div>
      <label>Fecha disponible<input type="date" min={minDate} max={maxDate} value={date} onChange={(event) => { setDate(event.target.value); setStartsAt(""); setSlots([]); setError(false); }} required /></label>
      <div className="admin-slot-picker" role="group" aria-label="Horarios disponibles para la próxima sesión del paquete">
        <div className="admin-slot-picker__heading">
          <strong>Horarios disponibles</strong>
          <span>Se valida la disponibilidad del tratamiento, la especialidad y el profesional autoasignado.</span>
        </div>
        {loading ? <p className="admin-slot-picker__message" role="status">Consultando disponibilidad real...</p> : null}
        {error ? <p className="form-message form-message--error" role="alert">No pudimos consultar horarios. Probá otra fecha o revisá la vigencia del paquete.</p> : null}
        {!loading && !error && slots.length === 0 ? <p className="admin-slot-picker__message">No hay horarios disponibles para esa fecha.</p> : null}
        {slots.length > 0 ? <div className="admin-slot-picker__grid">{slots.map((slot) => (
          <label key={slot.startsAt} className={`admin-slot-option${startsAt === slot.startsAt ? " is-selected" : ""}`}>
            <input type="radio" name="packageSlot" checked={startsAt === slot.startsAt} onChange={() => setStartsAt(slot.startsAt)} />
            <span>{slotTime(slot.startsAt)}</span>
          </label>
        ))}</div> : null}
      </div>
      <label>Nota interna<input name="internalNotes" maxLength={1000} /></label>
      <AdminSubmitButton pendingLabel="Asignando…" disabled={!startsAt}>Asignar sesión</AdminSubmitButton>
    </form>
  );
}
