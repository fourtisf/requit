import { describe, expect, it } from "vitest";
import { dailySeed, dailyWindow, dayOf } from "@/lib/games/daily";
import { GAME_SLUGS } from "@/lib/games/catalog";

describe("the day a board belongs to", () => {
  it("is the UTC date, so a board does not change under anyone at midnight local", () => {
    expect(dayOf(new Date("2026-09-12T23:59:59Z"))).toBe("2026-09-12");
    expect(dayOf(new Date("2026-09-13T00:00:01Z"))).toBe("2026-09-13");
    // Late evening in Jakarta is already tomorrow's board, and early morning in
    // Los Angeles is still yesterday's. One clock, stated.
    expect(dayOf(new Date("2026-09-13T06:00:00+07:00"))).toBe("2026-09-12");
  });
});

describe("the seed for a day", () => {
  it("is the same every time it is asked for", () => {
    // The whole feature rests on this: two players on the same day must be
    // given the identical board, or the comparison means nothing.
    expect(dailySeed("spot", "2026-09-12")).toBe(dailySeed("spot", "2026-09-12"));
  });

  it("differs between games on the same day", () => {
    const seeds = new Set(GAME_SLUGS.map((game) => dailySeed(game, "2026-09-12")));
    expect(seeds.size).toBe(GAME_SLUGS.length);
  });

  it("differs between days, and not by a little", () => {
    // A counter would let a player learn the drift and stop needing the board.
    const monday = dailySeed("blocks", "2026-09-14");
    const tuesday = dailySeed("blocks", "2026-09-15");
    expect(monday).not.toBe(tuesday);
    expect(Math.abs(monday - tuesday)).toBeGreaterThan(1_000);
  });

  it("stays inside the column the database gives it", () => {
    // seed is a 32-bit signed int in the schema.
    for (const game of GAME_SLUGS) {
      for (let day = 1; day <= 28; day += 1) {
        const seed = dailySeed(game, `2026-09-${String(day).padStart(2, "0")}`);
        expect(seed).toBeGreaterThan(0);
        expect(seed).toBeLessThanOrEqual(2 ** 31 - 1);
        expect(Number.isInteger(seed)).toBe(true);
      }
    }
  });

  it("spreads across the range rather than clustering", () => {
    const seeds = Array.from({ length: 200 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
      return dailySeed("merge", day);
    });
    expect(new Set(seeds).size).toBe(seeds.length);

    const buckets = new Array<number>(4).fill(0);
    for (const seed of seeds) buckets[Math.floor((seed / 2 ** 31) * 4)]! += 1;
    for (const count of buckets) expect(count).toBeGreaterThan(20);
  });
});

describe("the window a daily round has to land in", () => {
  it("is the UTC day", () => {
    const window = dailyWindow(new Date("2026-09-12T14:00:00Z"));
    expect(window.start.toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  });
});
