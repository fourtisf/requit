import { beforeEach, describe, expect, it } from "vitest";
import { finishSession, personalBest, personalBests, startSession } from "@/lib/games/session";
import { GAME_SLUGS, type GameSlug } from "@/lib/games/catalog";
import { PLAYERS } from "@/test/players";
import { makeUser, prisma, resetDatabase } from "@/test/db";

/**
 * The round lifecycle against a real database.
 *
 * The rules are proven in the unit suite; what needs a real Postgres is the
 * part that decides whose round it is, which rules score it, and what stops the
 * same round being scored twice — all of which are conditions on a row rather
 * than anything a mocked client would model.
 */

beforeEach(async () => {
  await resetDatabase();
});

/** Every game at zero. Built from the catalog, so a new game cannot break it. */
const NOTHING_PLAYED = Object.fromEntries(GAME_SLUGS.map((slug) => [slug, 0])) as Record<
  GameSlug,
  number
>;

let seq = 0;
async function member() {
  seq += 1;
  return makeUser({ email: `p${seq}@example.com`, handle: `p${seq}` });
}

/** Opens a round and plays it out, the way a browser would. */
async function round(userId: string, game: GameSlug) {
  const opened = await startSession(userId, game);
  const played = PLAYERS[game](opened.seed);
  return { ...opened, played };
}

describe("opening a round", () => {
  it("stores the game it was opened under, and a seed of its own", async () => {
    const user = await member();
    const opened = await startSession(user.id, "trail");

    const row = await prisma.gameSession.findUniqueOrThrow({ where: { id: opened.id } });
    expect(row.game).toBe("trail");
    expect(row.seed).toBe(opened.seed);
    expect(row.endedAt).toBeNull();
    expect(row.score).toBe(0);
  });

  it("gives different rounds different seeds", async () => {
    const user = await member();
    const seeds = new Set<number>();
    for (let index = 0; index < 8; index += 1) {
      seeds.add((await startSession(user.id, "merge")).seed);
    }
    // A predictable seed is a solvable seed: someone who can guess tomorrow's
    // can pre-compute a perfect game for it.
    expect(seeds.size).toBe(8);
  });
});

describe.each(GAME_SLUGS)("scoring a round of %s", (game) => {
  it("writes the score the rules produce, not one it was told", async () => {
    const user = await member();
    const { id, played } = await round(user.id, game);

    const result = await finishSession({ userId: user.id, sessionId: id, moves: played.moves });
    expect(result).toEqual({
      ok: true,
      score: played.score,
      moves: played.moves.length,
      best: played.best,
    });

    const row = await prisma.gameSession.findUniqueOrThrow({ where: { id } });
    expect(row.score).toBe(played.score);
    expect(row.moves).toBe(played.moves.length);
    expect(row.bestTile).toBe(played.best);
    expect(row.endedAt).not.toBeNull();
  });

  it("refuses a second submission for the same round", async () => {
    const user = await member();
    const { id, played } = await round(user.id, game);

    expect((await finishSession({ userId: user.id, sessionId: id, moves: played.moves })).ok).toBe(
      true,
    );
    // The second submission is the interesting one: a player who kept the seed
    // could otherwise replay the round at leisure and send a better list.
    const again = await finishSession({ userId: user.id, sessionId: id, moves: played.moves });
    expect(again).toEqual({ ok: false, reason: "already-finished" });

    const row = await prisma.gameSession.findUniqueOrThrow({ where: { id } });
    expect(row.score).toBe(played.score);
  });
});

describe("whose round it is", () => {
  it("reads somebody else's round as missing rather than forbidden", async () => {
    const owner = await member();
    const stranger = await member();
    const { id, played } = await round(owner.id, "merge");

    expect(await finishSession({ userId: stranger.id, sessionId: id, moves: played.moves })).toEqual(
      { ok: false, reason: "not-found" },
    );
    const row = await prisma.gameSession.findUniqueOrThrow({ where: { id } });
    expect(row.endedAt).toBeNull();
  });

  it("refuses a round id that does not exist", async () => {
    const user = await member();
    expect(await finishSession({ userId: user.id, sessionId: "nope", moves: [] })).toEqual({
      ok: false,
      reason: "not-found",
    });
  });
});

describe("the stored slug decides the rules", () => {
  it("scores a round as the game it was opened under", async () => {
    // The submission carries moves and nothing else. A round of Flood played
    // well cannot be handed in as a round of Merge, because the game is not
    // something the browser gets to say.
    const user = await member();
    const opened = await startSession(user.id, "flood");
    const flood = PLAYERS.flood(opened.seed);

    const result = await finishSession({
      userId: user.id,
      sessionId: opened.id,
      moves: flood.moves,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score).toBe(flood.score);
  });

  it("refuses a move list from another game's rules", async () => {
    const user = await member();
    const opened = await startSession(user.id, "merge");
    // Flood's moves are numbers; merge's parser only knows directions.
    const result = await finishSession({ userId: user.id, sessionId: opened.id, moves: [0, 1, 2] });

    expect(result).toEqual({ ok: false, reason: "bad-moves" });
    const row = await prisma.gameSession.findUniqueOrThrow({ where: { id: opened.id } });
    expect(row.endedAt).toBeNull();
  });

  it("refuses a round whose game is no longer in the catalog", async () => {
    // A game withdrawn while someone had a round open. There are no rules left
    // to score it with, so it is not scored — and it is not scored as merge.
    const user = await member();
    const opened = await startSession(user.id, "merge");
    await prisma.gameSession.update({ where: { id: opened.id }, data: { game: "solitaire" } });

    expect(await finishSession({ userId: user.id, sessionId: opened.id, moves: [] })).toEqual({
      ok: false,
      reason: "unknown-game",
    });
  });
});

describe("personal bests", () => {
  it("is zero for someone who has not played", async () => {
    const user = await member();
    expect(await personalBest(user.id, "merge")).toBe(0);
    expect(await personalBests(user.id)).toEqual(NOTHING_PLAYED);
  });

  it("keeps the best finished round of each game, per player", async () => {
    const user = await member();
    const other = await member();

    await prisma.gameSession.createMany({
      data: [
        { userId: user.id, game: "merge", seed: 1, score: 120, endedAt: new Date() },
        { userId: user.id, game: "merge", seed: 2, score: 340, endedAt: new Date() },
        { userId: user.id, game: "trail", seed: 3, score: 90, endedAt: new Date() },
        // Unfinished, and somebody else's. Neither counts.
        { userId: user.id, game: "merge", seed: 4, score: 9_000 },
        { userId: other.id, game: "merge", seed: 5, score: 8_000, endedAt: new Date() },
      ],
    });

    expect(await personalBest(user.id, "merge")).toBe(340);
    expect(await personalBests(user.id)).toEqual({ ...NOTHING_PLAYED, merge: 340, trail: 90 });
  });

  it("ignores a game that is no longer on the shelf", async () => {
    const user = await member();
    await prisma.gameSession.create({
      data: { userId: user.id, game: "solitaire", seed: 1, score: 500, endedAt: new Date() },
    });
    expect(await personalBests(user.id)).toEqual(NOTHING_PLAYED);
  });
});
