import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { type GameSlug, GAME_SLUGS, isGameSlug, verify } from "@/lib/games/catalog";

/**
 * Starting and finishing a round, server-side.
 *
 * Both halves exist to make one guarantee: the score in the database is the
 * score of a game that was actually played. The seed is ours, the replay is
 * ours, and the browser's own opinion of how it did is never read.
 *
 * Nothing in this file knows what any game is. It opens a row against a slug
 * from the catalog, and scores one by asking the catalog to replay the round
 * under the slug the row already holds — which is what keeps a fourth game from
 * being a fourth place this guarantee could be dropped.
 */

/** Seeds stay inside a 32-bit signed int, which is the column's width. */
const MAX_SEED = 2 ** 31 - 1;

export async function startSession(
  userId: string,
  game: GameSlug,
  /**
   * A seed chosen by the server — today's board, and nothing else.
   *
   * It is an argument rather than a flag so that this function keeps knowing
   * nothing about what a "daily" is: it opens a round on the seed it is handed,
   * and the one caller allowed to hand it one is the route that derives it from
   * the date.
   */
  fixed?: number,
): Promise<{ id: string; seed: number; game: GameSlug }> {
  // randomInt, not Math.random: a predictable seed is a solvable seed, and
  // someone who can predict tomorrow's seeds can pre-compute perfect games.
  const seed = fixed ?? randomInt(1, MAX_SEED);

  const session = await prisma.gameSession.create({
    data: { userId, game, seed },
    select: { id: true, seed: true },
  });
  return { ...session, game };
}

export type FinishFailure =
  | "not-found"
  | "already-finished"
  | "unknown-game"
  | "bad-moves"
  | "too-many-moves"
  | "illegal-move";

export type FinishResult =
  | { ok: true; score: number; moves: number; best: number }
  | { ok: false; reason: FinishFailure };

/**
 * Scores a round by replaying it.
 *
 * The update is conditioned on endedAt still being null, in the same statement
 * that sets it. Two submissions racing — or one player submitting twice with a
 * better second list — means the second finds nothing to update and is told the
 * round is already finished.
 */
export async function finishSession(input: {
  userId: string;
  sessionId: string;
  moves: unknown;
}): Promise<FinishResult> {
  const session = await prisma.gameSession.findFirst({
    // userId in the filter, not checked afterwards: a session id belonging to
    // someone else must read as missing, not as forbidden.
    where: { id: input.sessionId, userId: input.userId },
    select: { id: true, game: true, seed: true, endedAt: true },
  });
  if (!session) return { ok: false, reason: "not-found" };
  if (session.endedAt) return { ok: false, reason: "already-finished" };
  // A slug the catalog no longer knows — a game withdrawn while someone had a
  // round open. There are no rules left to score it with, so it is not scored.
  if (!isGameSlug(session.game)) return { ok: false, reason: "unknown-game" };

  const result = verify(session.game, session.seed, input.moves);
  if (!result.ok) return { ok: false, reason: result.reason };

  const { count } = await prisma.gameSession.updateMany({
    where: { id: session.id, endedAt: null },
    data: {
      endedAt: new Date(),
      score: result.score,
      moves: result.moves,
      // The column is called bestTile because merge was the only game when it
      // was added. Each game names its own second number — see the catalog.
      bestTile: result.best,
    },
  });
  if (count === 0) return { ok: false, reason: "already-finished" };

  return { ok: true, score: result.score, moves: result.moves, best: result.best };
}

/** The player's own best round of one game, for the page header. */
export async function personalBest(userId: string, game: GameSlug): Promise<number> {
  const row = await prisma.gameSession.findFirst({
    where: { userId, game, endedAt: { not: null } },
    orderBy: { score: "desc" },
    select: { score: true },
  });
  return row?.score ?? 0;
}

/**
 * Every game's personal best in one query, for the shelf.
 *
 * One groupBy rather than a query per game: the shelf grows every time a game
 * is added, and a loop of awaits there would quietly become four round trips,
 * then six.
 */
export async function personalBests(userId: string): Promise<Record<GameSlug, number>> {
  const rows = await prisma.gameSession.groupBy({
    by: ["game"],
    where: { userId, game: { in: [...GAME_SLUGS] }, endedAt: { not: null } },
    _max: { score: true },
  });

  const bests = Object.fromEntries(GAME_SLUGS.map((slug) => [slug, 0])) as Record<GameSlug, number>;
  for (const row of rows) {
    if (isGameSlug(row.game)) bests[row.game] = row._max.score ?? 0;
  }
  return bests;
}
