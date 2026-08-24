import type { BookingStatus } from "@/domain/treatment";

export const ADMIN_AGENDA_PAGE_SIZE = 25;
export const ADMIN_AGENDA_VIEWS = ["day", "week", "all"] as const;

export type AdminAgendaView = (typeof ADMIN_AGENDA_VIEWS)[number];
export type AdminAgendaStatus = BookingStatus | "all";

export interface AdminAgendaQuery {
  view: AdminAgendaView;
  date: string;
  status: AdminAgendaStatus;
  page: number;
}

export interface AdminAgendaRange {
  startsAt: string | null;
  endsAt: string | null;
  previousDate: string;
  nextDate: string;
  label: string;
}

const BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending",
  "awaiting_deposit",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "expired",
];

function cordobaDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function moveDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localMidnightIso(date: string) {
  return new Date(`${date}T00:00:00-03:00`).toISOString();
}

function shortDateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function parseAdminAgendaQuery(
  input: Record<string, string | undefined>,
  now = new Date(),
): AdminAgendaQuery {
  const view = ADMIN_AGENDA_VIEWS.includes(input.agendaView as AdminAgendaView)
    ? input.agendaView as AdminAgendaView
    : "day";
  const status = BOOKING_STATUSES.includes(input.agendaStatus as BookingStatus)
    ? input.agendaStatus as BookingStatus
    : "all";
  const parsedPage = Number.parseInt(input.agendaPage ?? "1", 10);

  return {
    view,
    date: isDateKey(input.agendaDate) ? input.agendaDate : cordobaDateKey(now),
    status,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function getAdminAgendaRange(query: AdminAgendaQuery): AdminAgendaRange {
  if (query.view === "all") {
    return {
      startsAt: null,
      endsAt: null,
      previousDate: query.date,
      nextDate: query.date,
      label: "Historial completo",
    };
  }

  if (query.view === "day") {
    const nextDate = moveDate(query.date, 1);
    return {
      startsAt: localMidnightIso(query.date),
      endsAt: localMidnightIso(nextDate),
      previousDate: moveDate(query.date, -1),
      nextDate,
      label: shortDateLabel(query.date),
    };
  }

  const selected = new Date(`${query.date}T12:00:00Z`);
  const mondayOffset = (selected.getUTCDay() + 6) % 7;
  const weekStart = moveDate(query.date, -mondayOffset);
  const weekEnd = moveDate(weekStart, 7);
  return {
    startsAt: localMidnightIso(weekStart),
    endsAt: localMidnightIso(weekEnd),
    previousDate: moveDate(query.date, -7),
    nextDate: moveDate(query.date, 7),
    label: `${shortDateLabel(weekStart)} al ${shortDateLabel(moveDate(weekEnd, -1))}`,
  };
}

export function adminAgendaPageRange(page: number, pageSize = ADMIN_AGENDA_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function adminAgendaHref(
  current: AdminAgendaQuery,
  changes: Partial<AdminAgendaQuery>,
) {
  const next = { ...current, ...changes };
  const params = new URLSearchParams({
    agendaView: next.view,
    agendaDate: next.date,
    agendaStatus: next.status,
    agendaPage: String(next.page),
  });
  return `/admin?${params.toString()}#reservas`;
}
