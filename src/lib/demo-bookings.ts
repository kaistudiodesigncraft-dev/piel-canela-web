import type {
  BookingStatus,
  DemoBooking,
  DemoBookingQuery,
  MonthlySpecial,
  Treatment,
} from "@/domain/treatment";

export const bookingStatusMeta: Record<
  BookingStatus,
  { label: string; shortLabel: string }
> = {
  pending: { label: "Pendiente de contacto", shortLabel: "Pendiente" },
  awaiting_deposit: { label: "Esperando seña", shortLabel: "Seña pendiente" },
  confirmed: { label: "Turno confirmado", shortLabel: "Confirmado" },
  completed: { label: "Atención realizada", shortLabel: "Realizado" },
  cancelled: { label: "Turno cancelado", shortLabel: "Cancelado" },
  no_show: { label: "No asistió", shortLabel: "Ausente" },
};

export function buildAdminDemoHref(booking: DemoBooking): string {
  const params = new URLSearchParams({
    demoCode: booking.code,
    demoName: booking.customerName,
    demoPhone: booking.phone,
    demoDate: booking.startsAt.slice(0, 10),
    demoTime: booking.startsAt.slice(11, 16),
    demoTreatmentId: booking.treatmentId,
  });
  if (booking.email) params.set("demoEmail", booking.email);
  if (booking.monthlySpecialId) {
    params.set("demoMonthlySpecialId", booking.monthlySpecialId);
  }
  if (booking.customerNotes) params.set("demoNotes", booking.customerNotes);
  return `/admin?${params.toString()}#reservas`;
}

export function resolveDemoBookingFromQuery(
  query: DemoBookingQuery,
  treatments: readonly Treatment[],
  monthlySpecials: readonly MonthlySpecial[],
): DemoBooking | undefined {
  const treatment = treatments.find(
    (item) => item.id === query.demoTreatmentId && item.isActive,
  );
  if (
    !treatment ||
    !query.demoCode ||
    !query.demoName ||
    !query.demoPhone ||
    !/^\d{4}-\d{2}-\d{2}$/.test(query.demoDate ?? "") ||
    !/^\d{2}:\d{2}$/.test(query.demoTime ?? "")
  ) {
    return undefined;
  }

  const special = monthlySpecials.find(
    (item) =>
      item.id === query.demoMonthlySpecialId &&
      item.treatmentId === treatment.id &&
      item.isActive,
  );

  return {
    id: `booking-${query.demoCode.toLowerCase()}`,
    code: query.demoCode,
    treatmentId: treatment.id,
    monthlySpecialId: special?.id,
    customerName: query.demoName,
    phone: query.demoPhone,
    email: query.demoEmail,
    startsAt: `${query.demoDate}T${query.demoTime}:00-03:00`,
    durationMinutes: treatment.durationMinutes,
    priceCents: special?.specialPriceCents ?? treatment.priceCents,
    status: "pending",
    customerNotes: query.demoNotes,
    internalNotes: "Reserva creada durante la demostración pública.",
    createdAt: "2026-07-31T23:30:00-03:00",
    isNew: true,
  };
}

export function formatBookingDate(startsAt: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(startsAt));
}

export function formatBookingTime(startsAt: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(startsAt));
}
