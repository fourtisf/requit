import { rng, shuffle } from "@/lib/games/rng";
import { type Engine, type GameRules } from "@/lib/games/engine";

/**
 * Recall — sixteen cards, eight pairs, turn them over two at a time.
 *
 * The engine holds the deal and hands out only what the table is showing: a
 * card's symbol appears in `revealed` when it is face up or already matched,
 * and is null the rest of the time. That is not a defence — the browser has the
 * seed and this same code, so anyone determined can recompute the deal — and it
 * is worth doing anyway, because a view should be given what it displays and
 * nothing else.
 *
 * The honest note about that gap lives in lib/games/engine.ts: a replay proves
 * a round is a legal game, never that a human played it. Recall is the clearest
 * case in the catalog, and it is the reason a high score is not what turns into
 * money here — a paying network's server-side callback is.
 */

export const PAIRS = 8;
export const CARDS = PAIRS * 2;

/** 100 a pair, less 15 for every attempt that missed. Never below zero. */
export const MATCH_POINTS = 100;
export const MISS_PENALTY = 15;

/**
 * A ceiling on flips, so a round always ends. A player this far in has scored
 * zero for a while; the limit is there to bound the replay, not to punish.
 */
export const MAX_FLIPS = 120;

export type RecallState = {
  /** Pair id where the table is showing one, null where it is face down. */
  revealed: readonly (number | null)[];
  /** The one or two positions turned over right now. */
  faceUp: readonly number[];
  matched: readonly boolean[];
  flips: number;
  matches: number;
  misses: number;
  /** Matches found in a row. Broken by a miss. */
  streak: number;
  score: number;
  over: boolean;
  /** The longest that streak got. */
  best: number;
};

function scoreOf(matches: number, misses: number): number {
  return Math.max(0, matches * MATCH_POINTS - misses * MISS_PENALTY);
}

export function createRecall(seed: number): Engine<number, RecallState> {
  const pairs: number[] = [];
  for (let id = 0; id < PAIRS; id += 1) pairs.push(id, id);
  const cards = shuffle(pairs, rng(seed));

  let faceUp: number[] = [];
  const matched = new Array<boolean>(CARDS).fill(false);
  let flips = 0;
  let matches = 0;
  let misses = 0;
  let streak = 0;
  let best = 0;
  let over = false;

  return {
    state: () => ({
      revealed: cards.map((card, position) =>
        matched[position] || faceUp.includes(position) ? card : null,
      ),
      faceUp: [...faceUp],
      matched: [...matched],
      flips,
      matches,
      misses,
      streak,
      best,
      score: scoreOf(matches, misses),
      over,
    }),
    play: (position) => {
      if (over) return false;
      if (!Number.isInteger(position) || position < 0 || position >= CARDS) return false;
      if (matched[position]) return false;

      // Two face-up cards that were not a pair. The board has been showing them
      // since the last flip; this one turns them back and starts a new attempt.
      if (faceUp.length === 2) faceUp = [];
      if (faceUp.includes(position)) return false;

      faceUp.push(position);
      flips += 1;

      if (faceUp.length === 2) {
        const [first, second] = faceUp as [number, number];
        if (cards[first] === cards[second]) {
          matched[first] = true;
          matched[second] = true;
          matches += 1;
          streak += 1;
          if (streak > best) best = streak;
          faceUp = [];
          if (matches === PAIRS) over = true;
        } else {
          misses += 1;
          streak = 0;
        }
      }

      if (flips >= MAX_FLIPS) over = true;
      return true;
    },
  };
}

export const RECALL_RULES: GameRules<number> = {
  maxMoves: MAX_FLIPS,
  create: createRecall,
  parse: (value) => (typeof value === "number" && Number.isInteger(value) ? value : null),
};
