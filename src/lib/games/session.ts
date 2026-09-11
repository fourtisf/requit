import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { type Direction, isDirection } from "@/lib/games/merge";
import { MAX_MOVES, replay } from "@/lib/games/play";

/**
 * Starting and finishing a round, server-side.
 *
 * Both halves exist to make one guarantee: the score in the database is the
 * score of a game that was actually played. The seed is ours, the replay is
 * ours, and the browser's own opinion of how it did is never read.
 */

export const GAME = "merge";

/** Seeds stay inside a 32-bit signed int, which is the column's width. */
const MAX_SEED = 2 ** 31 - 1;

export async function startSession(userId: string): Promise<{ id: string; seed: number }> {
  // randomInt, not Math.random: a predictable seed is a solvable seed, and
  // someone who can predict tomorrow's seeds can pre-compute perfect games.
  const seed = randomInt(1, MAX_SEED);

  const session = await prisma.gameSession.create({
    data: { userId, game: GAME, seed },
    select: { id: true, seed: true },
  });
  return session;
}

export type FinishFailure =
  | "not-found"
  | "already-finished"
  | "bad-moves"
  | "too-many-moves"
  | "illegal-move";

export type FinishResult =
  | { ok: true; score: number; moves: number; bestTile: number }
  | { ok: false; reason: FinishFailure };

/** Parses the submitted move list. Anything malformed fails the whole round. */
export function parseMoves(input: unknown): Direction[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > MAX_MOVES) return null;

  const moves: Direction[] = [];
  for (const value of input) {
    if (!isDirection(value)) return null;
    moves.push(value);
  }
  return moves;
}

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
  const moves = parseMoves(input.moves);
  if (!moves) return { ok: false, reason: "bad-moves" };

  const session = await prisma.gameSession.findFirst({
    // userId in the filter, not checked afterwards: a session id belonging to
    // someone else must read as missing, not as forbidden.
    where: { id: input.sessionId, userId: input.userId, game: GAME },
    select: { id: true, seed: true, endedAt: true },
  });
  if (!session) return { ok: false, reason: "not-found" };
  if (session.endedAt) return { ok: false, reason: "already-finished" };

  const result = replay(session.seed, moves);
  if (!result.ok) return { ok: false, reason: result.reason };

  const { count } = await prisma.gameSession.updateMany({
    where: { id: session.id, endedAt: null },
    data: {
      endedAt: new Date(),
      score: result.score,
      moves: result.moves,
      bestTile: result.best,
    },
  });
  if (count === 0) return { ok: false, reason: "already-finished" };

  return { ok: true, score: result.score, moves: result.moves, bestTile: result.best };
}

/** The player's own best round, for the page header. */
export async function personalBest(userId: string): Promise<number> {
  const row = await prisma.gameSession.findFirst({
    where: { userId, game: GAME, endedAt: { not: null } },
    orderBy: { score: "desc" },
    select: { score: true },
  });
  return row?.score ?? 0;
}
