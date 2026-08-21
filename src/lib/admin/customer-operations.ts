import type { BookingStatus } from "@/domain/treatment";

export const RESCHEDULABLE_BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending",
  "awaiting_deposit",
  "confirmed",
];

export function canRescheduleBooking(status: BookingStatus) {
  return RESCHEDULABLE_BOOKING_STATUSES.includes(status);
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export function customerSearchText(input: {
  fullName: string;
  phone: string;
  email: string | null;
}) {
  return `${input.fullName} ${input.phone} ${input.email ?? ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function buildAdminWhatsAppMessage(input: {
  customerName: string;
  bookingCode: string;
  treatmentName: string;
  startsAtLabel: string;
}) {
  return [
    `Hola ${input.customerName}, te escribimos de Piel Canela.`,
    "",
    `Reserva: ${input.bookingCode}`,
    `Tratamiento: ${input.treatmentName}`,
    `Fecha: ${input.startsAtLabel}`,
  ].join("\n");
}
