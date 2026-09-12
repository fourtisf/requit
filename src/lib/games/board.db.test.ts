import { beforeEach, describe, expect, it } from "vitest";
import { standing, topScores } from "@/lib/games/board";
import { prizeWeek } from "@/lib/games/prizes";
import { makeUser, prisma, resetDatabase } from "@/test/db";

/**
 * The board against a real database.
 *
 * What needs Postgres here is the grouping: one row per player rather than per
 * round, ranked across everyone, with a window that has to agree with the one a
 * distribution would use. None of that is provable against a mocked client.
 */

beforeEach(async () => {
  await resetDatabase();
});

let seq = 0;
async function member(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return makeUser({ email: `b${seq}@example.com`, handle: `player${seq}`, ...overrides });
}

async function round(userId: string, score: number, endedAt: Date | null = new Date()) {
  return prisma.gameSession.create({
    data: { userId, game: "spot", seed: 1, score, endedAt },
  });
}

const THIS_WEEK = prizeWeek();
const LAST_WEEK = new Date(THIS_WEEK.start.getTime() - 60 * 60 * 1000);

describe("the top of a game", () => {
  it("is empty before anyone plays", async () => {
    expect(await topScores("spot", null)).toEqual([]);
  });

  it("ranks players by their best round, highest first", async () => {
    const ada = await member();
    const bob = await member();
    await round(ada.id, 300);
    await round(bob.id, 900);

    const rows = await topScores("spot", null);
    expect(rows.map((row) => [row.rank, row.handle, row.score])).toEqual([
      [1, bob.handle, 900],
      [2, ada.handle, 300],
    ]);
  });

  it("gives a player one row, not one per round", async () => {
    // A board of rounds is a board one person fills on a good afternoon.
    const ada = await member();
    await round(ada.id, 100);
    await round(ada.id, 800);
    await round(ada.id, 400);

    const rows = await topScores("spot", null);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.score).toBe(800);
  });

  it("counts only finished rounds", async () => {
    const ada = await member();
    await round(ada.id, 9_000, null);
    expect(await topScores("spot", null)).toEqual([]);
  });

  it("counts only the game asked for", async () => {
    const ada = await member();
    await prisma.gameSession.create({
      data: { userId: ada.id, game: "merge", seed: 1, score: 5_000, endedAt: new Date() },
    });
    expect(await topScores("spot", null)).toEqual([]);
    expect(await topScores("merge", null)).toHaveLength(1);
  });

  it("hides the handle of a member who turned it off, and keeps their row", async () => {
    // Removing the row would shift everyone else's rank and make the board
    // wrong. Withholding the name is what the member actually asked for.
    const quiet = await member({ publicPayouts: false });
    const loud = await member();
    await round(quiet.id, 900);
    await round(loud.id, 300);

    const rows = await topScores("spot", null);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rank: 1, handle: null, score: 900 });
    expect(rows[1]).toMatchObject({ rank: 2, handle: loud.handle, score: 300 });
  });

  it("stops at the limit it was given", async () => {
    for (let index = 0; index < 5; index += 1) {
      const player = await member();
      await round(player.id, 100 * (index + 1));
    }
    expect(await topScores("spot", null, 3)).toHaveLength(3);
  });

  it("leaves out a week it was not asked about", async () => {
    const ada = await member();
    const bob = await member();
    await round(ada.id, 900, LAST_WEEK);
    await round(bob.id, 100);

    const week = await topScores("spot", THIS_WEEK);
    expect(week.map((row) => row.score)).toEqual([100]);
    // The all-time board still has both.
    expect(await topScores("spot", null)).toHaveLength(2);
  });
});

describe("where a player stands", () => {
  it("is nothing at all before they finish a round", async () => {
    const ada = await member();
    expect(await standing(ada.id, "spot", null)).toEqual({ best: 0, rank: null });
  });

  it("counts everyone ahead, not just the ones on the visible page", async () => {
    // A player at 12th has to be told 12th, or the number is a lie for everyone
    // outside the top ten — which is nearly everyone.
    const me = await member();
    await round(me.id, 100);
    for (let index = 0; index < 11; index += 1) {
      const better = await member();
      await round(better.id, 500 + index);
    }

    expect(await standing(me.id, "spot", null)).toEqual({ best: 100, rank: 12 });
  });

  it("ties are counted as the same rank rather than an invented order", async () => {
    const me = await member();
    const twin = await member();
    await round(me.id, 400);
    await round(twin.id, 400);

    expect((await standing(me.id, "spot", null)).rank).toBe(1);
    expect((await standing(twin.id, "spot", null)).rank).toBe(1);
  });

  it("is measured inside the window it was given", async () => {
    const me = await member();
    await round(me.id, 900, LAST_WEEK);
    await round(me.id, 200);

    expect(await standing(me.id, "spot", THIS_WEEK)).toEqual({ best: 200, rank: 1 });
    expect(await standing(me.id, "spot", null)).toEqual({ best: 900, rank: 1 });
  });
});
