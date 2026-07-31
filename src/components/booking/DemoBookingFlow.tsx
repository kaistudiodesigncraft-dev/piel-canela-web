"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Info,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { demoScheduleDates, demoTimeSlots } from "@/data/demo-bookings";
import type {
  DemoBooking,
  ResolvedBookingSelection,
} from "@/domain/treatment";
import { buildAdminDemoHref } from "@/lib/demo-bookings";
import { formatDuration, formatPrice } from "@/lib/format";

type BookingStep = "schedule" | "details" | "review" | "success";

interface DemoBookingFlowProps {
  selection: ResolvedBookingSelection;
}

interface CustomerForm {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
}

const initialCustomer: CustomerForm = {
  fullName: "",
  phone: "",
  email: "",
  notes: "",
};

const stepOrder: BookingStep[] = ["schedule", "details", "review", "success"];

export function DemoBookingFlow({ selection }: DemoBookingFlowProps) {
  const [step, setStep] = useState<BookingStep>("schedule");
  const [date, setDate] = useState<string>(demoScheduleDates[0].value);
  const [time, setTime] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>(initialCustomer);
  const [showMessagePreview, setShowMessagePreview] = useState(false);

  const selectedDate = demoScheduleDates.find((item) => item.value === date);
  const currentStepIndex = stepOrder.indexOf(step);

  const booking = useMemo<DemoBooking | null>(() => {
    if (step !== "success" || !time) return null;
    return {
      id: "booking-pc-demo-4821",
      code: "PC-DEMO-4821",
      treatmentId: selection.treatmentId,
      monthlySpecialId: selection.monthlySpecialId,
      customerName: customer.fullName,
      phone: customer.phone,
      email: customer.email || undefined,
      startsAt: `${date}T${time}:00-03:00`,
      durationMinutes: selection.durationMinutes,
      priceCents: selection.appliedPriceCents,
      status: "pending",
      customerNotes: customer.notes || undefined,
      createdAt: "2026-07-31T23:30:00-03:00",
      isNew: true,
    };
  }, [customer, date, selection, step, time]);

  function continueFromSchedule() {
    if (time) setStep("details");
  }

  function continueFromDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customer.fullName.trim() && customer.phone.trim()) setStep("review");
  }

  function updateCustomer(field: keyof CustomerForm, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  if (step === "success" && booking && selectedDate && time) {
    const adminHref = buildAdminDemoHref(booking);
    const whatsappMessage = [
      "Hola, quiero confirmar mi pre-reserva en Piel Canela.",
      `Tratamiento: ${selection.treatmentName}`,
      `Fecha: ${selectedDate.weekday} ${selectedDate.day} de agosto`,
      `Horario: ${time}`,
      `Nombre: ${customer.fullName}`,
      `Código: ${booking.code}`,
    ].join("\n");

    return (
      <section className="booking-success" aria-labelledby="booking-success-title">
        <div className="booking-success__mark" aria-hidden="true">
          <Check strokeWidth={1.75} />
        </div>
        <p className="eyebrow">Pre-reserva creada</p>
        <h1 id="booking-success-title">Tu horario quedó reservado de forma provisional.</h1>
        <p className="booking-success__lead">
          Para confirmarlo, Piel Canela te enviará los datos de la seña por WhatsApp.
          En esta demo ningún mensaje ni pago es real.
        </p>

        <dl className="booking-confirmation numeric">
          <div>
            <dt>Código</dt>
            <dd>{booking.code}</dd>
          </div>
          <div>
            <dt>Tratamiento</dt>
            <dd>{selection.monthlySpecialTitle ?? selection.treatmentName}</dd>
          </div>
          <div>
            <dt>Cuándo</dt>
            <dd>{selectedDate.weekday} {selectedDate.day}, {time}</dd>
          </div>
          <div>
            <dt>Valor</dt>
            <dd>{formatPrice(selection.appliedPriceCents)}</dd>
          </div>
        </dl>

        <div className="booking-success__actions">
          <button
            className="button button--primary"
            type="button"
            onClick={() => setShowMessagePreview((current) => !current)}
            aria-expanded={showMessagePreview}
          >
            <MessageCircle aria-hidden="true" strokeWidth={1.75} />
            Simular mensaje de WhatsApp
          </button>
          <Link className="button button--secondary" href={adminHref}>
            Ver esta reserva en el panel
            <ExternalLink aria-hidden="true" strokeWidth={1.75} />
          </Link>
        </div>

        {showMessagePreview ? (
          <div className="message-preview" aria-live="polite">
            <div>
              <MessageCircle aria-hidden="true" strokeWidth={1.75} />
              <strong>Vista previa del mensaje</strong>
            </div>
            <pre>{whatsappMessage}</pre>
          </div>
        ) : null}

        <Link className="text-link" href="/tratamientos">
          Volver al catálogo
        </Link>
      </section>
    );
  }

  return (
    <section className="booking-flow" aria-labelledby="booking-flow-title">
      <div className="booking-flow__header">
        <div>
          <p className="eyebrow">Reserva demostrativa</p>
          <h1 id="booking-flow-title">
            {step === "schedule" && "Elegí cuándo querés venir."}
            {step === "details" && "Contanos cómo contactarte."}
            {step === "review" && "Revisá antes de crear la pre-reserva."}
          </h1>
        </div>
        <div className="demo-badge">
          <Info aria-hidden="true" strokeWidth={1.75} />
          Sin envío real
        </div>
      </div>

      <ol className="booking-progress" aria-label="Progreso de la reserva">
        {[
          ["schedule", "Fecha y horario"],
          ["details", "Tus datos"],
          ["review", "Revisión"],
        ].map(([value, label]) => (
          <li
            key={value}
            className={
              step === value
                ? "is-current"
                : currentStepIndex > stepOrder.indexOf(value as BookingStep)
                  ? "is-complete"
                  : ""
            }
            aria-current={step === value ? "step" : undefined}
          >
            {label}
          </li>
        ))}
      </ol>

      <div className="booking-flow__layout">
        <div className="booking-flow__main">
          {step === "schedule" ? (
            <div className="booking-step-panel">
              <fieldset>
                <legend>Elegí un día</legend>
                <div className="date-choice-grid">
                  {demoScheduleDates.map((item) => (
                    <button
                      key={item.value}
                      className={`date-choice${date === item.value ? " is-selected" : ""}`}
                      type="button"
                      aria-pressed={date === item.value}
                      onClick={() => {
                        setDate(item.value);
                        setTime(null);
                      }}
                    >
                      <span>{item.weekday}</span>
                      <strong>{item.day}</strong>
                      <small>{item.month}</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Horarios disponibles</legend>
                <div className="time-choice-grid numeric">
                  {demoTimeSlots.map((slot) => (
                    <button
                      key={slot.value}
                      className={`time-choice${time === slot.value ? " is-selected" : ""}`}
                      type="button"
                      disabled={!slot.isAvailable}
                      aria-pressed={time === slot.value}
                      onClick={() => setTime(slot.value)}
                    >
                      {slot.value}
                      {!slot.isAvailable ? <span>Ocupado</span> : null}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="booking-step-actions booking-step-actions--end">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!time}
                  onClick={continueFromSchedule}
                >
                  Continuar
                  <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ) : null}

          {step === "details" ? (
            <form className="booking-step-panel booking-form" onSubmit={continueFromDetails}>
              <div className="field-grid">
                <label className="field field--wide">
                  <span>Nombre y apellido</span>
                  <input
                    type="text"
                    name="fullName"
                    autoComplete="name"
                    required
                    value={customer.fullName}
                    onChange={(event) => updateCustomer("fullName", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>WhatsApp</span>
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    required
                    placeholder="351 555 0000"
                    value={customer.phone}
                    onChange={(event) => updateCustomer("phone", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Correo <small>opcional</small></span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={customer.email}
                    onChange={(event) => updateCustomer("email", event.target.value)}
                  />
                </label>
                <label className="field field--wide">
                  <span>¿Querés contarnos algo? <small>opcional</small></span>
                  <textarea
                    name="notes"
                    rows={3}
                    maxLength={240}
                    value={customer.notes}
                    onChange={(event) => updateCustomer("notes", event.target.value)}
                  />
                  <small>{customer.notes.length}/240</small>
                </label>
              </div>

              <p className="form-assurance">
                <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
                En la demo estos datos solo viven en esta pantalla y en la URL del panel.
              </p>

              <div className="booking-step-actions">
                <button className="button button--quiet" type="button" onClick={() => setStep("schedule")}>
                  <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
                  Volver
                </button>
                <button className="button button--primary" type="submit">
                  Revisar reserva
                  <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                </button>
              </div>
            </form>
          ) : null}

          {step === "review" && selectedDate && time ? (
            <div className="booking-step-panel">
              <dl className="booking-review numeric">
                <div>
                  <dt><CalendarDays aria-hidden="true" strokeWidth={1.75} />Fecha</dt>
                  <dd>{selectedDate.weekday} {selectedDate.day} de agosto</dd>
                </div>
                <div>
                  <dt><Clock3 aria-hidden="true" strokeWidth={1.75} />Horario</dt>
                  <dd>{time}</dd>
                </div>
                <div>
                  <dt><UserRound aria-hidden="true" strokeWidth={1.75} />A nombre de</dt>
                  <dd>{customer.fullName}</dd>
                </div>
                <div>
                  <dt>WhatsApp</dt>
                  <dd>{customer.phone}</dd>
                </div>
              </dl>

              <div className="pending-explanation">
                <Info aria-hidden="true" strokeWidth={1.75} />
                <div>
                  <strong>Esto crea una pre-reserva, no un turno confirmado.</strong>
                  <p>La confirmación final ocurre cuando Piel Canela verifica la seña.</p>
                </div>
              </div>

              <div className="booking-step-actions">
                <button className="button button--quiet" type="button" onClick={() => setStep("details")}>
                  <ArrowLeft aria-hidden="true" strokeWidth={1.75} />
                  Corregir datos
                </button>
                <button className="button button--primary" type="button" onClick={() => setStep("success")}>
                  Crear pre-reserva simulada
                  <Check aria-hidden="true" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="booking-selection-rail" aria-label="Resumen del tratamiento">
          <p className="eyebrow">Tu elección</p>
          <h2>{selection.monthlySpecialTitle ?? selection.treatmentName}</h2>
          {selection.monthlySpecialTitle ? <p>{selection.treatmentName}</p> : null}
          <dl className="numeric">
            <div>
              <dt>Duración</dt>
              <dd>{formatDuration(selection.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{formatPrice(selection.appliedPriceCents)}</dd>
            </div>
          </dl>
          {selectedDate && time ? (
            <p className="booking-selection-rail__slot">
              <CalendarDays aria-hidden="true" strokeWidth={1.75} />
              {selectedDate.weekday} {selectedDate.day}, {time}
            </p>
          ) : (
            <p className="booking-selection-rail__hint">Elegí fecha y horario para completar el resumen.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
