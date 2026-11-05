import {
  ServicePackageRulesSchema,
  type ServicePackageRules,
} from "./booking-config";

export type ServicePackageSessionState = "reserved" | "completed" | "released" | "lost";
export type ServicePackageEvent = "attended" | "released" | "absence";

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
