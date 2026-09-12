import type { BookingStatus } from "@/domain/treatment";
import type { MessageEvent, MessageTemplates } from "@/domain/whatsapp";
import { resolveWhatsAppMessage } from "@/lib/whatsapp/templates";

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
  startsAt?: string;
  messageTemplates?: MessageTemplates;
  event?: MessageEvent;
  comboName?: string;
  durationMinutes?: number;
  address?: string;
  depositText?: string;
}) {
  const instant = input.startsAt ? new Date(input.startsAt) : null;
  const validInstant = instant && Number.isFinite(instant.getTime());
  return resolveWhatsAppMessage(input.event ?? "preparation", input.messageTemplates ?? {}, {
    nombre: input.customerName,
    tratamiento: input.treatmentName,
    combo: input.comboName ?? "No aplica",
    fecha: validInstant ? new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba", dateStyle: "long" }).format(instant) : input.startsAtLabel,
    hora: validInstant ? new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba", timeStyle: "short" }).format(instant) : "(ver fecha)",
    duracion: input.durationMinutes ? `${input.durationMinutes} min` : "",
    codigo: input.bookingCode,
    direccion: input.address ?? "",
    sena: input.depositText ?? "",
  });
}
