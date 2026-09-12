import { type GameSlug } from "@/lib/games/catalog";
import { type LeaderboardWindow } from "@/lib/leaderboard";

/**
 * One board a day, the same one for everybody.
 *
 * The weekly board ranks the best score anyone reached on any seed, which is a
 * measure of how many rounds they played as much as how well: a lucky opening
 * in Blocks or a kind deal in Spot is worth more than an hour of thinking. With
 * one seed a day the comparison is exact — the same grid, the same pieces, the
 * same deal, and a score the server recomputed from the moves.
 *
 * Being able to do that at all is a consequence of how these games were built.
 * Every one of them is deterministic from a seed and replayed server-side, so
 * "everyone played this identical board" is a fact rather than a promise.
 *
 * The seed is derived from the date in the open, not from a secret. Anyone can
 * work out tomorrow's board a day early and plan it — and that is the same
 * person who could already run a solver on any seed, which lib/games/engine.ts
 * says plainly. What the openness buys is that two players can check they were
 * given the same board, which is the property the board is for.
 */

/** The day a board belongs to, in UTC, as YYYY-MM-DD. */
export function dayOf(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * FNV-1a, folded into the 32-bit signed range the seed column holds.
 *
 * A hash rather than a counter so consecutive days are unrelated: dates that
 * differ by one should not give boards that differ by one, or a player learns
 * the drift and stops needing the board at all.
 */
export function dailySeed(game: GameSlug, day: string = dayOf()): number {
  let hash = 0x811c9dc5;
  for (const character of `${game}:${day}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Zero is a legal seed but a confusing one to see in a row; shift off it.
  return (hash % (2 ** 31 - 2)) + 1;
}

/** The UTC day a daily round has to have ended inside to count for it. */
export function dailyWindow(now: Date = new Date()): LeaderboardWindow {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
