import { describe, expect, it } from "vitest";
import {
  buildWeeklyAvailability,
  copyMondayToWeekdays,
  serializeWeeklyAvailability,
  validateWeeklyAvailability,
} from "./weekly-availability";

describe("weekly availability", () => {
  const mondayRules = [{
    id: "rule-1",
    specialty_id: "specialty-1",
    weekday: 1,
    start_time: "09:00:00",
    end_time: "13:00:00",
  }, {
    id: "rule-2",
    specialty_id: "specialty-1",
    weekday: 1,
    start_time: "15:00:00",
    end_time: "20:00:00",
  }];

  it("builds and serializes a complete week with split shifts", () => {
    const week = buildWeeklyAvailability(mondayRules);
    expect(week).toHaveLength(7);
    expect(week[1]).toMatchObject({ enabled: true, ranges: [
      { startTime: "09:00", endTime: "13:00" },
      { startTime: "15:00", endTime: "20:00" },
    ] });
    expect(serializeWeeklyAvailability(week)).toEqual([
      { weekday: 1, start_time: "09:00", end_time: "13:00" },
      { weekday: 1, start_time: "15:00", end_time: "20:00" },
    ]);
  });

  it("copies Monday to Tuesday through Friday without changing the weekend", () => {
    const copied = copyMondayToWeekdays(buildWeeklyAvailability(mondayRules));
    expect(copied.filter((day) => day.enabled).map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(copied[5]?.ranges).toHaveLength(2);
    expect(copied[6]?.enabled).toBe(false);
  });

  it("rejects inverted and overlapping ranges", () => {
    const week = buildWeeklyAvailability(mondayRules);
    week[1]!.ranges[1] = { id: "overlap", startTime: "12:30", endTime: "14:00" };
    expect(validateWeeklyAvailability(week).errors[1]).toMatch(/superponerse/);
    week[1]!.ranges = [{ id: "invalid", startTime: "18:00", endTime: "09:00" }];
    expect(validateWeeklyAvailability(week).errors[1]).toMatch(/comenzar antes/);
  });
});
