function toTwentyFourHour(hour: number, meridiem?: string) {
  if (!meridiem) return hour;
  const normalized = meridiem.toLocaleLowerCase("es-AR");
  if (normalized === "am") return hour === 12 ? 0 : hour;
  if (normalized === "pm" && hour <= 12) return hour === 12 ? 12 : hour + 12;
  return hour;
}

function formatClock(hour: number, minute?: string) {
  const suffix = minute && minute !== "00" ? `:${minute}` : "";
  return `${hour}${suffix}`;
}

/** Normalizes common mixed 12/24-hour ranges for display without rewriting saved settings. */
export function formatReceptionHours(value: string) {
  return value.replace(
    /\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\b/gi,
    (match, startHourText: string, startMinute: string | undefined, startMeridiem: string | undefined, endHourText: string, endMinute: string | undefined, endMeridiem: string | undefined) => {
      const startHour = Number(startHourText);
      const endHour = Number(endHourText);
      if (startHour > 23 || endHour > 23) return match;
      const normalizedStart = toTwentyFourHour(startHour, startMeridiem ?? endMeridiem);
      const normalizedEnd = toTwentyFourHour(endHour, endMeridiem ?? startMeridiem);
      return `${formatClock(normalizedStart, startMinute)}–${formatClock(normalizedEnd, endMinute)} h`;
    },
  );
}
