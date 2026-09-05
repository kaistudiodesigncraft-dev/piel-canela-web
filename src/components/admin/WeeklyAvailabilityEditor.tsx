"use client";

import { Copy, Plus, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  saveWeeklyAvailability,
  type WeeklyAvailabilityActionState,
} from "@/app/admin/actions";
import {
  buildWeeklyAvailability,
  copyMondayToWeekdays,
  createDefaultRange,
  serializeWeeklyAvailability,
  validateWeeklyAvailability,
  WEEKDAY_NAMES,
  type StoredAvailabilityRule,
  type WeeklyAvailabilityDay,
} from "@/lib/admin/weekly-availability";

interface AvailabilitySpecialty {
  id: string;
  name: string;
  is_active: boolean;
}

interface AvailabilityTreatment {
  id: string;
  name: string;
  specialty_id: string;
  duration_minutes: number;
  buffer_minutes: number;
  start_interval_minutes: number;
  is_active: boolean;
}

interface WeeklyAvailabilityEditorProps {
  specialties: AvailabilitySpecialty[];
  rules: StoredAvailabilityRule[];
  treatments: AvailabilityTreatment[];
  initialSpecialtyId?: string;
  saved?: boolean;
}

function SaveWeekButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button button--primary" type="submit" disabled={disabled || pending} aria-disabled={disabled || pending}>
      {pending ? "Guardando semana…" : "Guardar semana"}
    </button>
  );
}

function cloneDays(days: WeeklyAvailabilityDay[]) {
  return days.map((day) => ({ ...day, ranges: day.ranges.map((range) => ({ ...range })) }));
}

export function WeeklyAvailabilityEditor({
  specialties,
  rules,
  treatments,
  initialSpecialtyId,
  saved,
}: WeeklyAvailabilityEditorProps) {
  const activeSpecialties = specialties.filter((specialty) => specialty.is_active);
  const initialId = activeSpecialties.some((specialty) => specialty.id === initialSpecialtyId)
    ? initialSpecialtyId as string
    : activeSpecialties[0]?.id ?? "";
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState(initialId);
  const [days, setDays] = useState(() => buildWeeklyAvailability(rules.filter((rule) => rule.specialty_id === initialId)));
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const initialActionState: WeeklyAvailabilityActionState = { status: "idle" };
  const [actionState, formAction] = useActionState(saveWeeklyAvailability, initialActionState);
  const validation = useMemo(() => validateWeeklyAvailability(days), [days]);
  const selectedSpecialty = activeSpecialties.find((specialty) => specialty.id === selectedSpecialtyId);
  const linkedTreatments = treatments.filter((treatment) => treatment.specialty_id === selectedSpecialtyId && treatment.is_active);
  const enabledDays = days.filter((day) => day.enabled && day.ranges.length > 0);

  function selectSpecialty(id: string) {
    if (id === selectedSpecialtyId) return;
    if (isDirty && !window.confirm("Hay cambios sin guardar en esta semana. ¿Querés descartarlos y cambiar de especialidad?")) {
      return;
    }
    setSelectedSpecialtyId(id);
    setDays(buildWeeklyAvailability(rules.filter((rule) => rule.specialty_id === id)));
    setAttemptedSubmit(false);
    setIsDirty(false);
  }

  function updateDay(weekday: number, updater: (day: WeeklyAvailabilityDay) => WeeklyAvailabilityDay) {
    setIsDirty(true);
    setDays((current) => current.map((day) => day.weekday === weekday ? updater(day) : day));
  }

  function toggleDay(weekday: number, enabled: boolean) {
    updateDay(weekday, (day) => ({
      ...day,
      enabled,
      ranges: enabled && day.ranges.length === 0 ? [createDefaultRange(weekday, 0)] : day.ranges,
    }));
  }

  function addRange(weekday: number) {
    updateDay(weekday, (day) => ({
      ...day,
      enabled: true,
      ranges: [...day.ranges, createDefaultRange(weekday, day.ranges.length)],
    }));
  }

  function removeRange(weekday: number, rangeId: string) {
    updateDay(weekday, (day) => ({ ...day, ranges: day.ranges.filter((range) => range.id !== rangeId) }));
  }

  function updateRange(weekday: number, rangeId: string, field: "startTime" | "endTime", value: string) {
    updateDay(weekday, (day) => ({
      ...day,
      ranges: day.ranges.map((range) => range.id === rangeId ? { ...range, [field]: value } : range),
    }));
  }

  if (activeSpecialties.length === 0) {
    return (
      <div className="admin-empty">
        <h3>Primero necesitás una especialidad activa.</h3>
        <p>Creala o reactivala en Especialidades para definir su disponibilidad semanal.</p>
      </div>
    );
  }

  const actionMessages = {
    invalid: "Revisá las franjas marcadas antes de guardar.",
    overlap: "Hay franjas superpuestas. Corregilas y volvé a guardar.",
    specialty: "La especialidad dejó de estar disponible. Elegí otra.",
    save: "No pudimos guardar la semana. No se modificó la disponibilidad anterior.",
  } as const;

  return (
    <form
      action={formAction}
      className="weekly-availability"
      onSubmit={(event) => {
        setAttemptedSubmit(true);
        if (!validation.valid) event.preventDefault();
      }}
    >
      <div className="weekly-availability__toolbar">
        <label htmlFor="availability-specialty">Especialidad
          <select
            id="availability-specialty"
            name="specialtyId"
            value={selectedSpecialtyId}
            onChange={(event) => selectSpecialty(event.target.value)}
          >
            {activeSpecialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}
          </select>
        </label>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => {
            setIsDirty(true);
            setDays((current) => copyMondayToWeekdays(cloneDays(current)));
          }}
        >
          <Copy aria-hidden="true" strokeWidth={1.75} />
          Copiar lunes a martes–viernes
        </button>
      </div>

      {saved ? <p className="form-message" role="status">La semana quedó guardada. Los turnos ya reservados no se modificaron.</p> : null}
      {isDirty ? <p className="admin-unsaved-note" role="status">Tenés cambios sin guardar en esta semana.</p> : null}
      {actionState.status === "error" ? <p className="form-message form-message--error" role="alert">{actionMessages[actionState.error ?? "save"]}</p> : null}

      <input type="hidden" name="rules" value={JSON.stringify(serializeWeeklyAvailability(days))} readOnly />

      <div className="weekly-availability__layout">
        <div className="weekly-availability__editor">
          <div className="weekly-availability__column-head" aria-hidden="true">
            <span>Día</span><span>Franjas disponibles</span>
          </div>
          {days.map((day) => {
            const dayError = validation.errors[day.weekday];
            return (
              <fieldset className={`weekly-day${day.enabled ? " is-open" : ""}${dayError ? " has-error" : ""}`} key={day.weekday}>
                <legend className="sr-only">{WEEKDAY_NAMES[day.weekday]}</legend>
                <label className="weekly-day__toggle">
                  <input type="checkbox" checked={day.enabled} onChange={(event) => toggleDay(day.weekday, event.target.checked)} />
                  <span><strong>{WEEKDAY_NAMES[day.weekday]}</strong><small>{day.enabled ? "Abierto" : "Cerrado"}</small></span>
                </label>
                <div className="weekly-day__ranges">
                  {!day.enabled ? <p>Cerrado</p> : day.ranges.map((range, index) => (
                    <div className="weekly-range" key={range.id}>
                      <label>
                        <span className="sr-only">Inicio de la franja {index + 1} del {WEEKDAY_NAMES[day.weekday]}</span>
                        <input type="time" value={range.startTime} onChange={(event) => updateRange(day.weekday, range.id, "startTime", event.target.value)} aria-invalid={Boolean(dayError) || undefined} />
                      </label>
                      <span aria-hidden="true">a</span>
                      <label>
                        <span className="sr-only">Fin de la franja {index + 1} del {WEEKDAY_NAMES[day.weekday]}</span>
                        <input type="time" value={range.endTime} onChange={(event) => updateRange(day.weekday, range.id, "endTime", event.target.value)} aria-invalid={Boolean(dayError) || undefined} />
                      </label>
                      <button className="weekly-range__remove" type="button" onClick={() => removeRange(day.weekday, range.id)} aria-label={`Quitar franja ${index + 1} del ${WEEKDAY_NAMES[day.weekday]}`}>
                        <X aria-hidden="true" strokeWidth={1.75} /><span>Quitar</span>
                      </button>
                    </div>
                  ))}
                  {day.enabled ? (
                    <button className="weekly-day__add" type="button" onClick={() => addRange(day.weekday)}>
                      <Plus aria-hidden="true" strokeWidth={1.75} />Agregar franja
                    </button>
                  ) : null}
                  {(attemptedSubmit || dayError) && dayError ? <p className="weekly-day__error" role="alert">{dayError}</p> : null}
                </div>
              </fieldset>
            );
          })}
        </div>

        <aside className="weekly-summary" aria-labelledby="weekly-summary-title">
          <h3 id="weekly-summary-title">Resumen operativo</h3>
          <p className="weekly-summary__specialty">{selectedSpecialty?.name}</p>
          {enabledDays.length === 0 ? (
            <p className="weekly-summary__warning">Esta especialidad no tiene días disponibles.</p>
          ) : (
            <dl className="weekly-summary__days">
              {enabledDays.map((day) => (
                <div key={day.weekday}>
                  <dt>{WEEKDAY_NAMES[day.weekday]}</dt>
                  <dd>{day.ranges.map((range) => `${range.startTime}–${range.endTime}`).join(" · ")}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="weekly-summary__treatments">
            <h4>Tratamientos vinculados</h4>
            {linkedTreatments.length === 0 ? <p className="weekly-summary__warning">Todavía no hay tratamientos activos para esta especialidad.</p> : (
              <ul>
                {linkedTreatments.map((treatment) => (
                  <li key={treatment.id}>
                    <strong>{treatment.name}</strong>
                    <span>{treatment.duration_minutes} min + {treatment.buffer_minutes} min de preparación</span>
                    <small>Inicios cada {treatment.start_interval_minutes} min</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="weekly-summary__note">Los turnos ya reservados no se modifican.</p>
        </aside>
      </div>

      <div className="weekly-availability__footer">
        <p>Los cambios afectan únicamente los horarios futuros que todavía estén libres.</p>
        <SaveWeekButton disabled={!validation.valid} />
      </div>
    </form>
  );
}
