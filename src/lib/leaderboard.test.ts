import { describe, expect, it } from "vitest";
import { currentWeek } from "@/lib/leaderboard";

describe("currentWeek", () => {
  it("runs Sunday to Sunday in UTC, matching the §9 accrual period", () => {
    // Thursday 2026-09-10 sits in the week that began Sunday 2026-09-06.
    const week = currentWeek(new Date("2026-09-10T14:30:00.000Z"));
    expect(week.start.toISOString()).toBe("2026-09-06T00:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });

  it("puts Sunday itself in the week it starts, not the one it ends", () => {
    const week = currentWeek(new Date("2026-09-06T00:00:01.000Z"));
    expect(week.start.toISOString()).toBe("2026-09-06T00:00:00.000Z");
  });

  it("spans exactly seven days", () => {
    const week = currentWeek(new Date("2026-09-10T14:30:00.000Z"));
    const days = (week.end.getTime() - week.start.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBe(7);
  });

  it("does not shift with the machine's timezone", () => {
    const week = currentWeek(new Date("2026-09-10T23:59:59.000Z"));
    expect(week.start.getUTCDay()).toBe(0);
    expect(week.start.getUTCHours()).toBe(0);
  });
});
