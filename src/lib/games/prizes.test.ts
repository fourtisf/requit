import { describe, expect, it } from "vitest";
import { PRIZE_GATE, prizeStatus, prizeWeek } from "@/lib/games/prizes";
import { currentWeek } from "@/lib/leaderboard";

describe("the prize gate", () => {
  it("is shut, and shut on the money first", () => {
    // The order matters: with no advertiser revenue, a prize is paid out of the
    // company's float, which is the arrangement this product exists to not be.
    expect(PRIZE_GATE).toEqual({ funded: false, cleared: false });
    expect(prizeStatus()).toEqual({ paying: false, reason: "no-revenue" });
  });

  it("still refuses on the law once the money exists", () => {
    expect(prizeStatus({ funded: true, cleared: false })).toEqual({
      paying: false,
      reason: "legally-gated",
    });
  });

  it("opens only when both are true", () => {
    expect(prizeStatus({ funded: true, cleared: true })).toEqual({ paying: true });
  });
});

describe("the week a board is ranked over", () => {
  it("is the same week the distribution would accrue against", () => {
    // One definition of a week, so a board and anything that ever pays from it
    // cannot disagree about which rounds were in it.
    const now = new Date("2026-09-12T14:00:00Z");
    expect(prizeWeek(now)).toEqual(currentWeek(now));
  });

  it("starts on Sunday, in UTC", () => {
    const week = prizeWeek(new Date("2026-09-12T14:00:00Z"));
    expect(week.start.getUTCDay()).toBe(0);
    expect(week.start.toISOString()).toBe("2026-09-06T00:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });
});
