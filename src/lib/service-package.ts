import {
  ServicePackageRulesSchema,
  type ServicePackageRules,
} from "./booking-config";

export type ServicePackageSessionState = "reserved" | "completed" | "released" | "lost";
export type ServicePackageEvent = "attended" | "released" | "absence";

export function describeServicePackageRules(rulesInput: ServicePackageRules): string[] {
  const rules = ServicePackageRulesSchema.parse(rulesInput);
  const lines = [
    `${rules.sessionsCount} sesiones con una vigencia de ${rules.validityDays} días desde ${rules.validityStartsFrom === "purchase" ? "la compra" : "la primera sesión"}.`,
  ];
  if (rules.minDaysBetweenSessions !== null) {
    lines.push(`Debe haber al menos ${rules.minDaysBetweenSessions} días entre sesiones.`);
  }
  lines.push(`Cada sesión admite hasta ${rules.maxReschedulesPerSession} ${rules.maxReschedulesPerSession === 1 ? "reprogramación" : "reprogramaciones"} y requiere ${rules.releaseNoticeHours} horas de aviso para liberarla a tiempo.`);
  lines.push(rules.absenceConsumesSession
    ? "Una ausencia consume la sesión."
    : "Una ausencia no consume la sesión.");
  lines.push(rules.lateReleaseConsumesSession
    ? "Una liberación fuera de término consume la sesión."
    : "Una liberación fuera de término no consume la sesión.");
  lines.push(rules.depositPercent === null
    ? "Se aplica la seña general vigente."
    : `La seña es del ${rules.depositPercent} %.`);
  if (rules.conditionsText) lines.push(rules.conditionsText);
  return lines;
}

export function calculateServicePackageBalance(input: {
  totalSessions: number;
  sessions: ReadonlyArray<{ status: ServicePackageSessionState }>;
}) {
  const consumed = input.sessions.filter(({ status }) =>
    status === "reserved" || status === "completed" || status === "lost"
  ).length;
  const balance = input.totalSessions - consumed;
  if (!Number.isInteger(input.totalSessions) || input.totalSessions < 0 || balance < 0) {
    throw new Error("service_package_balance_invalid");
  }
  return { total: input.totalSessions, consumed, balance };
}

export function suggestServicePackageOutcome(input: {
  rules: ServicePackageRules;
  event: ServicePackageEvent;
  appointmentStartsAt: Date;
  eventAt: Date;
}): Exclude<ServicePackageSessionState, "reserved"> {
  const rules = ServicePackageRulesSchema.parse(input.rules);
  if (input.event === "attended") return "completed";
  if (input.event === "absence") return rules.absenceConsumesSession ? "lost" : "released";

  const noticeDeadline = input.appointmentStartsAt.getTime()
    - rules.releaseNoticeHours * 60 * 60 * 1000;
  const releasedLate = input.eventAt.getTime() > noticeDeadline;
  return releasedLate && rules.lateReleaseConsumesSession ? "lost" : "released";
}
