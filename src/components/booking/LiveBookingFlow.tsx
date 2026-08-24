"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Info,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicBooking,
  getAvailableSlots,
} from "@/app/(public)/reservar/actions";
import type { ResolvedBookingSelection } from "@/domain/treatment";
import {
  buildWhatsAppUrl,
  formatBookingTime,
  type BookingDateOption,
} from "@/lib/booking";
import { formatDuration, formatPrice } from "@/lib/format";

type BookingStep = "schedule" | "details" | "review" | "success";

interface CustomerForm {
  fullName: string;
  phone: string;
  email: string;
  notes: string;
}

interface LiveBookingFlowProps {
  selection: ResolvedBookingSelection;
  dates: readonly BookingDateOption[];
  whatsappNumber: string | null;
}

const initialCustomer: CustomerForm = { fullName: "", phone: "", email: "", notes: "" };
const stepOrder: BookingStep[] = ["schedule", "details", "review", "success"];
const INITIAL_VISIBLE_SLOTS = 12;
const INITIAL_VISIBLE_DATES = 14;

export function LiveBookingFlow({ selection, dates, whatsappNumber }: LiveBookingFlowProps) {
  const [step, setStep] = useState<BookingStep>("schedule");
  const [date, setDate] = useState(dates[0]?.value ?? "");
  const [slots, setSlots] = useState<{ startsAt: string; endsAt: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>(initialCustomer);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true);
  const [slotsError, setSlotsError] = useState(false);
  const [slotRefresh, setSlotRefresh] = useState(0);
  const [visibleDateCount, setVisibleDateCount] = useState(INITIAL_VISIBLE_DATES);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ id: string; code: string } | null>(null);
  const [website, setWebsite] = useState("");
  const idempotencyKey = useRef<string | null>(null);
  const initialStepRender = useRef(true);

  const selectedDate = dates.find((item) => item.value === date);
  const selectedTime = selectedSlot ? formatBookingTime(selectedSlot) : null;
  const currentStepIndex = stepOrder.indexOf(step);
  const visibleSlots = showAllSlots ? slots : slots.slice(0, INITIAL_VISIBLE_SLOTS);
  const hiddenSlotCount = Math.max(0, slots.length - visibleSlots.length);
  const visibleDates = dates.slice(0, visibleDateCount);
  const hiddenDateCount = Math.max(0, dates.length - visibleDates.length);

  useEffect(() => {
    if (initialStepRender.current) {
      initialStepRender.current = false;
      return;
    }

    const frame = globalThis.requestAnimationFrame(() => {
      const heading = document.getElementById(
        step === "success" ? "booking-success-title" : "booking-flow-title",
      );
      if (!heading) return;

      heading.focus({ preventScroll: true });
      if (typeof heading.scrollIntoView === "function") {
        const reduceMotion = globalThis.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        heading.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      }
    });

    return () => globalThis.cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    let active = true;

    void getAvailableSlots({ treatmentId: selection.treatmentId, date }).then((result) => {
      if (!active) return;
      if (result.ok) {
        setSlots(result.slots);
      } else {
        setSlots([]);
        setSlotsError(true);
      }
      setIsLoadingSlots(false);
    });

    return () => {
      active = false;
    };
  }, [date, selection.treatmentId, slotRefresh]);

  const whatsappMessage = useMemo(() => {
    if (!booking || !selectedDate || !selectedTime) return "";
    return [
      "Hola, quiero confirmar mi pre-reserva en Piel Canela.",
      `Tratamiento: ${selection.monthlySpecialTitle ?? selection.treatmentName}`,
      `Fecha: ${selectedDate.longLabel}`,
      `Horario: ${selectedTime}`,
      `Nombre: ${customer.fullName}`,
      `Código: ${booking.code}`,
    ].join("\n");
  }, [booking, customer.fullName, selectedDate, selectedTime, selection]);

  function updateCustomer(field: keyof CustomerForm, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  function continueFromDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customer.fullName.trim().length >= 2 && customer.phone.trim().length >= 8) {
      setStep("review");
    }
  }

  async function submitBooking() {
    if (!selectedSlot) return;
    setIsSubmitting(true);
    setSubmitError(null);
    idempotencyKey.current ??= globalThis.crypto.randomUUID();

    const result = await createPublicBooking({
      treatmentId: selection.treatmentId,
      monthlySpecialId: selection.monthlySpecialId ?? null,
      startsAt: selectedSlot,
      idempotencyKey: idempotencyKey.current,
      website,
      ...customer,
    });

    setIsSubmitting(false);
    if (result.ok) {
      setBooking({ id: result.bookingId, code: result.bookingCode });
      setStep("success");
      return;
    }

    if (result.reason === "slot") {
      setSubmitError("Ese horario acaba de ocuparse. Elegí otra opción disponible.");
      setStep("schedule");
      setIsLoadingSlots(true);
      setSlotsError(false);
      setSelectedSlot(null);
      setSlotRefresh((current) => current + 1);
      return;
    }
    if (result.reason === "treatment" || result.reason === "special") {
      setSubmitError("La propuesta seleccionada ya no está disponible. Volvé al catálogo para elegir otra.");
      return;
    }
    if (result.reason === "rate_limited") {
      setSubmitError("Recibimos varios intentos desde esta conexión. Esperá una hora antes de volver a reservar.");
      return;
    }
    if (result.reason === "verification") {
      setSubmitError("No pudimos validar la solicitud. Actualizá la página e intentá nuevamente.");
      return;
    }
    setSubmitError("No pudimos crear la pre-reserva. Tus datos siguen en pantalla para que puedas intentarlo nuevamente.");
  }

  if (step === "success" && booking && selectedDate && selectedTime) {
    return (
      <section className="booking-success" aria-labelledby="booking-success-title">
        <div className="booking-success__mark" aria-hidden="true"><Check strokeWidth={1.75} /></div>
        <p className="eyebrow">Pre-reserva creada</p>
        <h1 id="booking-success-title" tabIndex={-1}>Tu horario quedó reservado de forma provisional.</h1>
        <p className="booking-success__lead">
          Para confirmarlo, enviá el resumen por WhatsApp y seguí las indicaciones para abonar la seña.
        </p>

        <dl className="booking-confirmation numeric">
          <div><dt>Código</dt><dd>{booking.code}</dd></div>
          <div><dt>Tratamiento</dt><dd>{selection.monthlySpecialTitle ?? selection.treatmentName}</dd></div>
          <div><dt>Cuándo</dt><dd>{selectedDate.longLabel}, {selectedTime}</dd></div>
          <div><dt>Valor</dt><dd>{formatPrice(selection.appliedPriceCents)}</dd></div>
        </dl>

        <div className="booking-success__actions">
          <a
            className="button button--primary"
            href={buildWhatsAppUrl(whatsappNumber, whatsappMessage)}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle aria-hidden="true" strokeWidth={1.75} />
            Continuar por WhatsApp
          </a>
        </div>
        <p className="booking-success__fine-print">
          La solicitud permanece pendiente hasta que Piel Canela confirme la seña.
        </p>
        <Link className="text-link" href="/tratamientos">Volver al catálogo</Link>
      </section>
    );
  }

  return (
    <section
      className={`booking-flow${
        step === "schedule" && selectedTime ? " booking-flow--mobile-action" : ""
      }`}
      aria-labelledby="booking-flow-title"
    >
      <div className="booking-flow__header">
        <div>
          <p className="eyebrow">Pre-reserva online</p>
          <h1 id="booking-flow-title" tabIndex={-1}>
            {step === "schedule" && "Elegí cuándo querés venir."}
            {step === "details" && "Contanos cómo contactarte."}
            {step === "review" && "Revisá antes de crear la pre-reserva."}
          </h1>
        </div>
        <div className="demo-badge">
          <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
          Disponibilidad verificada
        </div>
      </div>

      <ol className="booking-progress" aria-label="Progreso de la reserva">
        {[["schedule", "Fecha y horario"], ["details", "Tus datos"], ["review", "Revisión"]].map(([value, label]) => (
          <li
            key={value}
            className={step === value ? "is-current" : currentStepIndex > stepOrder.indexOf(value as BookingStep) ? "is-complete" : ""}
            aria-current={step === value ? "step" : undefined}
          >
            {label}
          </li>
        ))}
      </ol>

      {submitError ? <p className="form-message form-message--error" role="alert">{submitError}</p> : null}

      <div className="booking-flow__layout">
        <div className="booking-flow__main">
          {step === "schedule" ? (
            <div className="booking-step-panel">
              <fieldset>
                <legend>Elegí un día</legend>
                <div className="date-choice-grid">
                  {visibleDates.map((item) => (
                    <button
                      key={item.value}
                      className={`date-choice${date === item.value ? " is-selected" : ""}`}
                      type="button"
                      aria-pressed={date === item.value}
                      onClick={() => {
                        setDate(item.value);
                        setIsLoadingSlots(true);
                        setSlotsError(false);
                        setSelectedSlot(null);
                        setShowAllSlots(false);
                      }}
                    >
                      <span>{item.weekday}</span><strong>{item.day}</strong><small>{item.month}</small>
                    </button>
                  ))}
                </div>
                {hiddenDateCount > 0 ? (
                  <button
                    className="button button--quiet booking-dates-toggle"
                    type="button"
                    onClick={() => setVisibleDateCount((current) => Math.min(current + INITIAL_VISIBLE_DATES, dates.length))}
                  >
                    Ver {Math.min(INITIAL_VISIBLE_DATES, hiddenDateCount)} fechas más
                  </button>
                ) : null}
              </fieldset>

              <fieldset>
                <legend>Horarios disponibles</legend>
                {isLoadingSlots ? (
                  <p className="booking-inline-state" role="status">
                    <LoaderCircle className="is-spinning" aria-hidden="true" strokeWidth={1.75} /> Consultando horarios…
                  </p>
                ) : slotsError ? (
                  <p className="booking-inline-state booking-inline-state--error" role="alert">
                    No pudimos consultar la agenda. Intentá nuevamente en unos minutos.
                  </p>
                ) : slots.length === 0 ? (
                  <p className="booking-inline-state">No quedan horarios para este día. Probá con otra fecha.</p>
                ) : (
                  <>
                    <div className="time-choice-grid numeric">
                      {visibleSlots.map((slot) => (
                        <button
                          key={slot.startsAt}
                          className={`time-choice${selectedSlot === slot.startsAt ? " is-selected" : ""}`}
                          type="button"
                          aria-pressed={selectedSlot === slot.startsAt}
                          onClick={() => setSelectedSlot(slot.startsAt)}
                        >
                          {formatBookingTime(slot.startsAt)}
                        </button>
                      ))}
                    </div>
                    {slots.length > INITIAL_VISIBLE_SLOTS ? (
                      <button
                        className="button button--quiet booking-slots-toggle"
                        type="button"
                        aria-expanded={showAllSlots}
                        onClick={() => setShowAllSlots((current) => !current)}
                      >
                        {showAllSlots
                          ? "Ver menos horarios"
                          : `Ver ${hiddenSlotCount} horarios más`}
                      </button>
                    ) : null}
                  </>
                )}
              </fieldset>

              <div className="booking-step-actions booking-step-actions--end booking-step-actions--desktop">
                <button className="button button--primary" type="button" disabled={!selectedSlot} onClick={() => setStep("details")}>
                  Continuar <ArrowRight aria-hidden="true" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ) : null}

          {step === "details" ? (
            <form className="booking-step-panel booking-form" onSubmit={continueFromDetails}>
              <div className="sr-only" aria-hidden="true">
                <label>
                  Sitio web
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </label>
              </div>
              <div className="field-grid">
                <label className="field field--wide">
                  <span>Nombre y apellido</span>
                  <input type="text" name="fullName" autoComplete="name" minLength={2} maxLength={100} required value={customer.fullName} onChange={(event) => updateCustomer("fullName", event.target.value)} />
                </label>
                <label className="field">
                  <span>WhatsApp</span>
                  <input type="tel" name="phone" autoComplete="tel" minLength={8} maxLength={30} required placeholder="351 555 0000" value={customer.phone} onChange={(event) => updateCustomer("phone", event.target.value)} />
                </label>
                <label className="field">
                  <span>Correo <small>opcional</small></span>
                  <input type="email" name="email" autoComplete="email" maxLength={180} value={customer.email} onChange={(event) => updateCustomer("email", event.target.value)} />
                </label>
                <label className="field field--wide">
                  <span>¿Querés contarnos algo? <small>opcional</small></span>
                  <textarea name="notes" rows={3} maxLength={240} value={customer.notes} onChange={(event) => updateCustomer("notes", event.target.value)} />
                  <small>{customer.notes.length}/240</small>
                </label>
              </div>
              <p className="form-assurance">
                <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
                <span>Usamos estos datos únicamente para identificar y coordinar tu solicitud. Consultá nuestra <Link href="/privacidad">política de privacidad</Link>.</span>
              </p>
              <div className="booking-step-actions">
                <button className="button button--quiet" type="button" onClick={() => setStep("schedule")}><ArrowLeft aria-hidden="true" strokeWidth={1.75} />Volver</button>
                <button className="button button--primary" type="submit">Revisar reserva<ArrowRight aria-hidden="true" strokeWidth={1.75} /></button>
              </div>
            </form>
          ) : null}

          {step === "review" && selectedDate && selectedTime ? (
            <div className="booking-step-panel">
              <dl className="booking-review numeric">
                <div><dt><CalendarDays aria-hidden="true" strokeWidth={1.75} />Fecha</dt><dd>{selectedDate.longLabel}</dd></div>
                <div><dt><Clock3 aria-hidden="true" strokeWidth={1.75} />Horario</dt><dd>{selectedTime}</dd></div>
                <div><dt><UserRound aria-hidden="true" strokeWidth={1.75} />A nombre de</dt><dd>{customer.fullName}</dd></div>
                <div><dt>WhatsApp</dt><dd>{customer.phone}</dd></div>
              </dl>
              <div className="pending-explanation">
                <Info aria-hidden="true" strokeWidth={1.75} />
                <div><strong>Esto crea una pre-reserva, no un turno confirmado.</strong><p>La confirmación final ocurre cuando Piel Canela verifica la seña.</p></div>
              </div>
              <div className="booking-step-actions">
                <button className="button button--quiet" type="button" disabled={isSubmitting} onClick={() => setStep("details")}><ArrowLeft aria-hidden="true" strokeWidth={1.75} />Corregir datos</button>
                <button className="button button--primary" type="button" disabled={isSubmitting} onClick={submitBooking}>
                  {isSubmitting ? <><LoaderCircle className="is-spinning" aria-hidden="true" strokeWidth={1.75} />Creando…</> : <>Crear pre-reserva<Check aria-hidden="true" strokeWidth={1.75} /></>}
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
            <div><dt>Duración</dt><dd>{formatDuration(selection.durationMinutes)}</dd></div>
            <div><dt>Valor</dt><dd>{formatPrice(selection.appliedPriceCents)}</dd></div>
          </dl>
          {selectedDate && selectedTime ? (
            <p className="booking-selection-rail__slot"><CalendarDays aria-hidden="true" strokeWidth={1.75} />{selectedDate.longLabel}, {selectedTime}</p>
          ) : (
            <p className="booking-selection-rail__hint">Elegí fecha y horario para completar el resumen.</p>
          )}
        </aside>
      </div>

      {step === "schedule" && selectedTime ? (
        <div className="booking-mobile-action" role="region" aria-label="Horario seleccionado">
          <span><small>Horario seleccionado</small><strong className="numeric">{selectedTime}</strong></span>
          <button className="button button--primary" type="button" onClick={() => setStep("details")}>
            Continuar <ArrowRight aria-hidden="true" strokeWidth={1.75} />
          </button>
        </div>
      ) : null}
    </section>
  );
}
