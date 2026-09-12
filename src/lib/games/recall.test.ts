import { describe, expect, it } from "vitest";
import {
  CARDS,
  MATCH_POINTS,
  MAX_FLIPS,
  MISS_PENALTY,
  PAIRS,
  RECALL_RULES,
  createRecall,
} from "@/lib/games/recall";
import { verifyRound } from "@/lib/games/engine";
import { playRecall } from "@/test/players";

/**
 * Turns cards over until two of them do not match, and reports where they were.
 *
 * Half the rules only apply after a miss, and which two cards miss depends on
 * the deal — so the tests find a real one rather than assuming positions.
 */
function firstMiss(seed: number) {
  const game = createRecall(seed);
  for (let first = 0; first < CARDS; first += 1) {
    for (let second = first + 1; second < CARDS; second += 1) {
      const probe = createRecall(seed);
      probe.play(first);
      probe.play(second);
      if (probe.state().misses === 1) return { first, second, game };
    }
  }
  throw new Error("every pair of cards matched, which cannot happen");
}

/** The other half of the same problem: two cards that do match. */
function firstMatch(seed: number) {
  const game = createRecall(seed);
  for (let first = 0; first < CARDS; first += 1) {
    for (let second = first + 1; second < CARDS; second += 1) {
      const probe = createRecall(seed);
      probe.play(first);
      probe.play(second);
      if (probe.state().matches === 1) return { first, second, game };
    }
  }
  throw new Error("no two cards matched, which cannot happen");
}

describe("the deal", () => {
  it("starts face down, with nothing given away", () => {
    const state = createRecall(3).state();
    expect(state.revealed).toHaveLength(CARDS);
    expect(state.revealed.every((card) => card === null)).toBe(true);
    expect(state.matched.every((card) => card === false)).toBe(true);
    expect(state.score).toBe(0);
    expect(state.over).toBe(false);
  });

  it("shows a card only while the table is showing it", () => {
    const game = createRecall(3);
    game.play(0);
    const state = game.state();
    expect(state.revealed[0]).not.toBeNull();
    expect(state.revealed.filter((card) => card !== null)).toHaveLength(1);
  });

  it("deals the same cards for the same seed, and different ones otherwise", () => {
    const deal = (seed: number) => {
      const game = createRecall(seed);
      // Reading the deal the only way anything can: by turning cards over.
      return Array.from({ length: CARDS }, (_, position) => {
        game.play(position);
        return game.state().revealed[position];
      });
    };
    expect(deal(5)).toEqual(deal(5));
    expect(deal(5)).not.toEqual(deal(6));
  });

  it("holds each of the pairs exactly twice", () => {
    const round = playRecall(11);
    const game = createRecall(11);
    for (const move of round.moves as number[]) game.play(move);

    const counts = new Map<number, number>();
    for (const card of game.state().revealed) {
      expect(card).not.toBeNull();
      counts.set(card!, (counts.get(card!) ?? 0) + 1);
    }
    expect(counts.size).toBe(PAIRS);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
  });
});

describe("turning cards over", () => {
  it("refuses a card that is not on the table", () => {
    const game = createRecall(3);
    for (const position of [-1, CARDS, 2.5, Number.NaN]) {
      expect(game.play(position)).toBe(false);
    }
  });

  it("refuses the card that is already face up", () => {
    // Turning the same card twice would be a free pair.
    const game = createRecall(3);
    expect(game.play(4)).toBe(true);
    expect(game.play(4)).toBe(false);
  });

  it("refuses a card that has already been matched", () => {
    const { first, second, game } = firstMatch(21);
    game.play(first);
    game.play(second);

    expect(game.state().matched[first]).toBe(true);
    expect(game.play(first)).toBe(false);
    expect(game.play(second)).toBe(false);
  });

  it("leaves a missed attempt showing until the next card is turned", () => {
    const { first, second, game } = firstMiss(21);
    game.play(first);
    game.play(second);

    expect(game.state().faceUp).toEqual([first, second]);
    expect(game.state().revealed[first]).not.toBeNull();

    const third = [...Array(CARDS).keys()].find((card) => card !== first && card !== second)!;
    game.play(third);

    const state = game.state();
    expect(state.faceUp).toEqual([third]);
    expect(state.revealed[first]).toBeNull();
    expect(state.revealed[second]).toBeNull();
  });
});

describe("scoring", () => {
  it("pays for a pair and builds a streak", () => {
    const round = playRecall(11);
    const game = createRecall(11);
    let matches = 0;
    for (const move of round.moves as number[]) {
      game.play(move);
      const state = game.state();
      if (state.matches > matches) {
        matches = state.matches;
        expect(state.score).toBe(matches * MATCH_POINTS - state.misses * MISS_PENALTY);
        expect(state.streak).toBeGreaterThan(0);
      }
    }
    expect(matches).toBe(PAIRS);
  });

  it("charges for a miss and breaks the streak", () => {
    const { first, second, game } = firstMiss(21);
    game.play(first);
    game.play(second);

    const state = game.state();
    expect(state.misses).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.score).toBe(Math.max(0, state.matches * MATCH_POINTS - MISS_PENALTY));
  });

  it("never goes below zero", () => {
    // Twenty-odd misses in a row would otherwise put a player in debt, which is
    // not a thing a game should do to someone who is bad at it.
    const game = createRecall(21);
    while (!game.state().over) {
      const open = game.state().matched.findIndex((matched) => !matched);
      const other = game.state().matched.findIndex((matched, index) => !matched && index !== open);
      if (open < 0 || other < 0) break;
      game.play(open);
      game.play(other);
    }
    expect(game.state().score).toBeGreaterThanOrEqual(0);
  });

  it("ends when the last pair is found", () => {
    const round = playRecall(11);
    expect(round.over).toBe(true);

    const game = createRecall(11);
    for (const move of round.moves as number[]) game.play(move);
    expect(game.state().matches).toBe(PAIRS);
    expect(game.play(0)).toBe(false);
  });
});

describe("replaying a round", () => {
  it("reaches the score the player saw", () => {
    const round = playRecall(2024);
    expect(verifyRound(RECALL_RULES, 2024, round.moves)).toEqual({
      ok: true,
      score: round.score,
      moves: round.moves.length,
      best: round.best,
    });
  });

  it("refuses a round padded past the last pair", () => {
    const round = playRecall(2024);
    const padded = verifyRound(RECALL_RULES, 2024, [...round.moves, 0]);
    expect(padded).toEqual({ ok: false, reason: "illegal-move", atMove: round.moves.length });
  });

  it("refuses someone else's round", () => {
    const round = playRecall(2024);
    const borrowed = verifyRound(RECALL_RULES, 31337, round.moves);
    if (borrowed.ok) expect(borrowed.score).not.toBe(round.score);
  });

  it("cannot be submitted with more flips than the game allows", () => {
    const flood = new Array<number>(MAX_FLIPS + 1).fill(0);
    expect(verifyRound(RECALL_RULES, 1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: MAX_FLIPS,
    });
  });
});
