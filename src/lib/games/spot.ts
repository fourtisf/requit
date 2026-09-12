import { below, rng } from "@/lib/games/rng";
import { type Engine, type GameRules } from "@/lib/games/engine";

/**
 * Spot — one tile is not the same colour as the others. Tap it.
 *
 * There is no sentence to read here and nothing to learn. A player who has
 * never seen the game finds the odd tile on the first screen, and the game has
 * already taught itself. That is the entire reason it exists on this shelf:
 * every other game we built needed a rule explained first, and the ones that
 * needed it most were the ones nobody played.
 *
 * The difficulty is the difference, which shrinks each level until the tile is
 * genuinely hard to see. There is a clock as well, and it is deliberately NOT
 * here: a replay can prove a tap was legal and can never prove it was quick, so
 * the timer lives in the board (spot-board.tsx), ends the round, and adds
 * nothing to the score. What the server recomputes is levels cleared, which is
 * exactly what it can check.
 */

/** The round ends here even if the player is still finding them. */
export const MAX_LEVEL = 40;

/** A cleared level is worth this, times the level. */
export const LEVEL_POINTS = 10;

/** The grid starts at 2×2 and stops growing here. */
export const MIN_SIZE = 2;
export const MAX_SIZE = 7;

/** How much lighter the odd tile starts, and the floor it shrinks to. */
const START_DELTA = 22;
const MIN_DELTA = 3;

export type SpotLevel = {
  level: number;
  size: number;
  /** The colour of the field, and of the tile that is not part of it. */
  hue: number;
  light: number;
  oddLight: number;
  /**
   * Which cell is the odd one.
   *
   * The board has to be told, because the board has to draw it — and anything
   * the board knows, a determined player can read out of the page. That is true
   * of every game rendered in a browser and is why a score here is not money;
   * see the note in lib/games/engine.ts.
   */
  odd: number;
};

export type SpotState = SpotLevel & {
  score: number;
  over: boolean;
  /** The furthest level reached, which is the round's second number. */
  best: number;
};

export function sizeFor(level: number): number {
  return Math.min(MIN_SIZE + Math.floor(level / 2), MAX_SIZE);
}

export function deltaFor(level: number): number {
  return Math.max(MIN_DELTA, START_DELTA - level);
}

function deal(level: number, next: () => number): SpotLevel {
  const size = sizeFor(level);
  return {
    level,
    size,
    hue: below(360, next),
    // Mid lightness both ways, so the odd tile can be lighter without ever
    // washing out to white at the easy end.
    light: 46,
    oddLight: 46 + deltaFor(level),
    odd: below(size * size, next),
  };
}

export function createSpot(seed: number): Engine<number, SpotState> {
  const next = rng(seed);
  let current = deal(1, next);
  let score = 0;
  let best = 1;
  let over = false;

  return {
    state: () => ({ ...current, score, over, best }),
    play: (cell) => {
      if (over) return false;
      if (!Number.isInteger(cell) || cell < 0 || cell >= current.size * current.size) return false;

      if (cell !== current.odd) {
        // A wrong tile ends the round. It is a legal move — the last one.
        over = true;
        return true;
      }

      score += LEVEL_POINTS * current.level;
      if (current.level >= MAX_LEVEL) {
        over = true;
        return true;
      }

      current = deal(current.level + 1, next);
      best = current.level;
      return true;
    },
  };
}

export const SPOT_RULES: GameRules<number> = {
  // One tap a level, plus the wrong one that ends it.
  maxMoves: MAX_LEVEL + 1,
  create: createSpot,
  parse: (value) => (typeof value === "number" && Number.isInteger(value) ? value : null),
};
