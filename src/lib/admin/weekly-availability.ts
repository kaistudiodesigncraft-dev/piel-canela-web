export interface WeeklyAvailabilityRange {
  id: string;
  startTime: string;
  endTime: string;
}

export interface WeeklyAvailabilityDay {
  weekday: number;
  enabled: boolean;
  ranges: WeeklyAvailabilityRange[];
}

export interface StoredAvailabilityRule {
  id: string;
  specialty_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface WeeklyAvailabilityValidation {
  valid: boolean;
  errors: Record<number, string>;
}

export const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

const DEFAULT_RANGE = { startTime: "09:00", endTime: "18:00" };

function cleanTime(value: string) {
  return value.slice(0, 5);
}

function newRange(weekday: number, index: number, startTime = DEFAULT_RANGE.startTime, endTime = DEFAULT_RANGE.endTime) {
  return { id: `${weekday}-${index}-${startTime}-${endTime}`, startTime, endTime };
}

export function buildWeeklyAvailability(rules: readonly StoredAvailabilityRule[]): WeeklyAvailabilityDay[] {
  return WEEKDAY_NAMES.map((_, weekday) => {
    const ranges = rules
      .filter((rule) => rule.weekday === weekday)
      .sort((left, right) => left.start_time.localeCompare(right.start_time))
      .map((rule, index) => newRange(weekday, index, cleanTime(rule.start_time), cleanTime(rule.end_time)));
    return { weekday, enabled: ranges.length > 0, ranges };
  });
}

export function validateWeeklyAvailability(days: readonly WeeklyAvailabilityDay[]): WeeklyAvailabilityValidation {
  const errors: Record<number, string> = {};
  for (const day of days) {
    if (!day.enabled) continue;
    if (day.ranges.length === 0) {
      errors[day.weekday] = "Agregá al menos una franja o marcá el día como cerrado.";
      continue;
    }
    const sorted = [...day.ranges].sort((left, right) => left.startTime.localeCompare(right.startTime));
    if (sorted.some((range) => !/^\d{2}:\d{2}$/.test(range.startTime) || !/^\d{2}:\d{2}$/.test(range.endTime) || range.startTime >= range.endTime)) {
      errors[day.weekday] = "Cada franja debe comenzar antes de su hora de cierre.";
      continue;
    }
    if (sorted.some((range, index) => index > 0 && sorted[index - 1]!.endTime > range.startTime)) {
      errors[day.weekday] = "Las franjas del mismo día no pueden superponerse.";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function serializeWeeklyAvailability(days: readonly WeeklyAvailabilityDay[]) {
  return days.flatMap((day) => day.enabled
    ? day.ranges.map((range) => ({
      weekday: day.weekday,
      start_time: range.startTime,
      end_time: range.endTime,
    }))
    : []);
}

export function copyMondayToWeekdays(days: readonly WeeklyAvailabilityDay[]) {
  const monday = days.find((day) => day.weekday === 1);
  if (!monday) return [...days];
  return days.map((day) => {
    if (day.weekday < 2 || day.weekday > 5) return day;
    return {
      ...day,
      enabled: monday.enabled,
      ranges: monday.ranges.map((range, index) => newRange(day.weekday, index, range.startTime, range.endTime)),
    };
  });
}

export function createDefaultRange(weekday: number, index: number) {
  return newRange(weekday, index);
}
