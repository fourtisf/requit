import { describe, expect, it } from "vitest";
import {
  LEVEL_POINTS,
  MAX_LEVEL,
  MAX_SIZE,
  MIN_SIZE,
  SPOT_RULES,
  createSpot,
  deltaFor,
  sizeFor,
} from "@/lib/games/spot";
import { verifyRound } from "@/lib/games/engine";
import { playSpot } from "@/test/players";

describe("how the levels grow", () => {
  it("starts small and stops growing", () => {
    expect(sizeFor(1)).toBe(MIN_SIZE);
    expect(sizeFor(MAX_LEVEL)).toBe(MAX_SIZE);

    for (let level = 1; level < MAX_LEVEL; level += 1) {
      expect(sizeFor(level + 1)).toBeGreaterThanOrEqual(sizeFor(level));
      expect(sizeFor(level)).toBeLessThanOrEqual(MAX_SIZE);
    }
  });

  it("narrows the difference, but never to nothing", () => {
    // The difficulty is the difference, not a clock — a clock is the one thing
    // a replay cannot check.
    expect(deltaFor(1)).toBeGreaterThan(deltaFor(10));
    expect(deltaFor(10)).toBeGreaterThan(deltaFor(20));
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      expect(deltaFor(level)).toBeGreaterThan(0);
    }
  });
});

describe("a level", () => {
  it("puts one odd tile on the board", () => {
    const state = createSpot(12).state();
    expect(state.level).toBe(1);
    expect(state.odd).toBeGreaterThanOrEqual(0);
    expect(state.odd).toBeLessThan(state.size * state.size);
    expect(state.oddLight).toBeGreaterThan(state.light);
    expect(state.over).toBe(false);
  });

  it("deals the same board for the same seed, and a different one otherwise", () => {
    const deal = (seed: number) => {
      const { hue, odd, size } = createSpot(seed).state();
      return `${hue}:${odd}:${size}`;
    };
    expect(deal(5)).toBe(deal(5));
    expect(new Set([1, 2, 3, 4, 5, 6].map(deal)).size).toBeGreaterThan(1);
  });
});

describe("tapping", () => {
  it("moves on and scores the level when the odd tile is found", () => {
    const game = createSpot(12);
    const { odd, level } = game.state();

    expect(game.play(odd)).toBe(true);
    const after = game.state();
    expect(after.score).toBe(LEVEL_POINTS * level);
    expect(after.level).toBe(level + 1);
    expect(after.over).toBe(false);
  });

  it("pays more for later levels", () => {
    const game = createSpot(12);
    let previous = 0;
    let last = 0;

    for (let step = 0; step < 5; step += 1) {
      const before = game.state().score;
      game.play(game.state().odd);
      const gained = game.state().score - before;
      expect(gained).toBeGreaterThan(last);
      last = gained;
      previous = before;
    }
    expect(previous).toBeGreaterThan(0);
  });

  it("ends the round on any other tile", () => {
    const game = createSpot(12);
    const { odd, size } = game.state();
    const wrong = [...Array(size * size).keys()].find((cell) => cell !== odd)!;

    // A wrong tile is a legal move — the last one.
    expect(game.play(wrong)).toBe(true);
    expect(game.state().over).toBe(true);
    expect(game.play(game.state().odd)).toBe(false);
  });

  it("refuses a tile that is not on the board", () => {
    const game = createSpot(12);
    const { size } = game.state();
    for (const cell of [-1, size * size, 1.5, Number.NaN]) {
      expect(game.play(cell)).toBe(false);
    }
    expect(game.state().over).toBe(false);
  });
});

describe("a perfect round", () => {
  it("ends at the last level rather than running forever", () => {
    const round = playSpot(2024);
    expect(round.over).toBe(true);
    expect(round.moves).toHaveLength(MAX_LEVEL);
    expect(round.best).toBe(MAX_LEVEL);
  });

  it("scores every level it cleared", () => {
    const round = playSpot(2024);
    const expected = Array.from({ length: MAX_LEVEL }, (_, index) => LEVEL_POINTS * (index + 1));
    expect(round.score).toBe(expected.reduce((sum, points) => sum + points, 0));
  });
});

describe("replaying a round", () => {
  it("reaches the score the player saw", () => {
    const round = playSpot(2024);
    expect(verifyRound(SPOT_RULES, 2024, round.moves)).toEqual({
      ok: true,
      score: round.score,
      moves: round.moves.length,
      best: round.best,
    });
  });

  it("refuses a round padded past the end", () => {
    const round = playSpot(2024);
    const padded = verifyRound(SPOT_RULES, 2024, [...round.moves, 0]);
    expect(padded).toEqual({ ok: false, reason: "illegal-move", atMove: round.moves.length });
  });

  it("refuses someone else's round", () => {
    // The odd tile moves with the seed, so a borrowed list of taps lands on the
    // wrong tile and the round ends there instead of scoring.
    const round = playSpot(2024);
    const borrowed = verifyRound(SPOT_RULES, 31337, round.moves);
    if (borrowed.ok) expect(borrowed.score).not.toBe(round.score);
  });

  it("cannot be submitted with more taps than there are levels", () => {
    const flood = new Array<number>(SPOT_RULES.maxMoves + 1).fill(0);
    expect(verifyRound(SPOT_RULES, 1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: SPOT_RULES.maxMoves,
    });
  });
});
