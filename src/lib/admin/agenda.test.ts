import { describe, expect, it } from "vitest";
import {
  adminAgendaHref,
  adminAgendaPageRange,
  getAdminAgendaRange,
  parseAdminAgendaQuery,
} from "./agenda";

describe("admin agenda query", () => {
  it("defaults to the current Cordoba day", () => {
    expect(parseAdminAgendaQuery({}, new Date("2026-08-24T01:30:00Z"))).toEqual({
      view: "day",
      date: "2026-08-23",
      status: "all",
      page: 1,
    });
  });

  it("rejects invalid filters and pagination", () => {
    expect(parseAdminAgendaQuery({
      agendaView: "month",
      agendaDate: "2026-02-31",
      agendaStatus: "unknown",
      agendaPage: "-3",
    }, new Date("2026-08-23T12:00:00Z"))).toEqual({
      view: "day",
      date: "2026-08-23",
      status: "all",
      page: 1,
    });
  });

  it("builds an exact Cordoba day range", () => {
    const range = getAdminAgendaRange({ view: "day", date: "2026-08-23", status: "all", page: 1 });
    expect(range.startsAt).toBe("2026-08-23T03:00:00.000Z");
    expect(range.endsAt).toBe("2026-08-24T03:00:00.000Z");
    expect(range.previousDate).toBe("2026-08-22");
    expect(range.nextDate).toBe("2026-08-24");
  });

  it("builds a Monday-to-Sunday weekly range", () => {
    const range = getAdminAgendaRange({ view: "week", date: "2026-08-23", status: "confirmed", page: 2 });
    expect(range.startsAt).toBe("2026-08-17T03:00:00.000Z");
    expect(range.endsAt).toBe("2026-08-24T03:00:00.000Z");
    expect(range.previousDate).toBe("2026-08-16");
    expect(range.nextDate).toBe("2026-08-30");
  });

  it("calculates inclusive database ranges and stable links", () => {
    expect(adminAgendaPageRange(3)).toEqual({ from: 50, to: 74 });
    expect(adminAgendaHref(
      { view: "week", date: "2026-08-23", status: "all", page: 2 },
      { page: 1, status: "pending" },
    )).toBe("/admin?agendaView=week&agendaDate=2026-08-23&agendaStatus=pending&agendaPage=1#reservas");
  });
});
