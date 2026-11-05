import { describe, expect, it } from "vitest";
import type { ServicePackageRules } from "./booking-config";
import { calculateServicePackageBalance, suggestServicePackageOutcome } from "./service-package";

describe("service package rules", () => {
  const appointmentStartsAt = new Date("2026-12-10T15:00:00.000Z");
  const packageRules: ServicePackageRules = {
    sessionsCount: 6,
    validityDays: 180,
    validityStartsFrom: "purchase",
    minDaysBetweenSessions: null,
    releaseNoticeHours: 48,
    maxReschedulesPerSession: 1,
    absenceConsumesSession: true,
    lateReleaseConsumesSession: true,
    depositPercent: null,
    conditionsText: null,
  };

  it("derives balance without counting released sessions", () => {
    expect(calculateServicePackageBalance({
      totalSessions: 6,
      sessions: [
        { status: "reserved" },
        { status: "completed" },
        { status: "lost" },
        { status: "released" },
      ],
    })).toEqual({ total: 6, consumed: 3, balance: 3 });
  });

  it("rejects a negative derived balance", () => {
    expect(() => calculateServicePackageBalance({
      totalSessions: 1,
      sessions: [{ status: "reserved" }, { status: "completed" }],
    })).toThrow("service_package_balance_invalid");
  });

  it("keeps the balance invariant for every valid status distribution", () => {
    const statuses = ["reserved", "completed", "released", "lost"] as const;
    for (let total = 0; total <= 8; total += 1) {
      for (let reserved = 0; reserved <= total; reserved += 1) {
        for (let completed = 0; completed <= total - reserved; completed += 1) {
          for (let lost = 0; lost <= total - reserved - completed; lost += 1) {
            const released = total - reserved - completed - lost;
            const sessions = [
              ...Array.from({ length: reserved }, () => ({ status: statuses[0] })),
              ...Array.from({ length: completed }, () => ({ status: statuses[1] })),
              ...Array.from({ length: released }, () => ({ status: statuses[2] })),
              ...Array.from({ length: lost }, () => ({ status: statuses[3] })),
            ];
            const result = calculateServicePackageBalance({ totalSessions: total, sessions });
            expect(result.consumed).toBe(reserved + completed + lost);
            expect(result.balance).toBe(total - result.consumed);
            expect(result.balance).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it.each([
    ["attended", "2026-12-10T15:00:00.000Z", "completed"],
    ["released", "2026-12-08T14:59:59.000Z", "released"],
    ["released", "2026-12-09T15:00:01.000Z", "lost"],
    ["absence", "2026-12-10T15:00:00.000Z", "lost"],
  ] as const)("suggests %s as %s", (event, eventAt, expected) => {
    expect(suggestServicePackageOutcome({
      rules: packageRules,
      event,
      appointmentStartsAt,
      eventAt: new Date(eventAt),
    })).toBe(expected);
  });

  it("respects non-consuming absence and late-release rules", () => {
    const rules = {
      ...packageRules,
      absenceConsumesSession: false,
      lateReleaseConsumesSession: false,
    };
    expect(suggestServicePackageOutcome({
      rules,
      event: "absence",
      appointmentStartsAt,
      eventAt: appointmentStartsAt,
    })).toBe("released");
    expect(suggestServicePackageOutcome({
      rules,
      event: "released",
      appointmentStartsAt,
      eventAt: appointmentStartsAt,
    })).toBe("released");
  });
});
