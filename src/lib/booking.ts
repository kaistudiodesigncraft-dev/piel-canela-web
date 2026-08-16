const BUSINESS_TIME_ZONE = "America/Argentina/Cordoba";

export interface BookingDateOption {
  value: string;
  weekday: string;
  day: string;
  month: string;
  longLabel: string;
}

function cordobaDateParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function buildBookingDates(now = new Date(), count = 14): BookingDateOption[] {
  const dateParts = cordobaDateParts(now).split("-").map(Number);
  const year = dateParts[0] ?? now.getUTCFullYear();
  const month = dateParts[1] ?? now.getUTCMonth() + 1;
  const day = dateParts[2] ?? now.getUTCDate();
  const start = new Date(Date.UTC(year, month - 1, day, 12));

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const value = date.toISOString().slice(0, 10);
    const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })
      .format(date)
      .replace(".", "");
    const monthName = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: "UTC" })
      .format(date)
      .replace(".", "");
    const longLabel = new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date);

    return {
      value,
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
      day: String(date.getUTCDate()),
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      longLabel,
    };
  });
}

export function formatBookingTime(isoDate: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(new Date(isoDate));
}

export function buildWhatsAppUrl(number: string | null, message: string) {
  const digits = number?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
