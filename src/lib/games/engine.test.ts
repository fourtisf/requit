import { describe, expect, it } from "vitest";
import { type Engine, type GameRules, verifyRound } from "@/lib/games/engine";

/**
 * A game with no rules worth speaking of, so these tests are about the
 * verifier rather than about any one game.
 *
 * It counts up, refuses zero, and ends at three — enough shape to exercise a
 * legal round, an illegal move and a finished board.
 */
function createCounter(seed: number): Engine<number> {
  let score = seed;
  let played = 0;

  return {
    state: () => ({ score, over: played >= 3, best: played }),
    play: (value) => {
      if (played >= 3 || value === 0) return false;
      score += value;
      played += 1;
      return true;
    },
  };
}

const RULES: GameRules<number> = {
  maxMoves: 3,
  create: createCounter,
  parse: (value) => (typeof value === "number" ? value : null),
};

describe("verifying a submitted round", () => {
  it("scores a legal round", () => {
    expect(verifyRound(RULES, 10, [1, 2])).toEqual({ ok: true, score: 13, moves: 2, best: 2 });
  });

  it("scores an empty round as the starting position rather than failing", () => {
    expect(verifyRound(RULES, 10, [])).toEqual({ ok: true, score: 10, moves: 0, best: 0 });
  });

  it("takes the seed into account", () => {
    // The seed is half of what is being checked. Replaying someone else's move
    // list against your own round does not reproduce their score.
    expect(verifyRound(RULES, 99, [1])).not.toEqual(verifyRound(RULES, 10, [1]));
  });

  it("refuses something that is not a list", () => {
    for (const submitted of ["up", null, undefined, { 0: 1, length: 1 }]) {
      expect(verifyRound(RULES, 1, submitted)).toEqual({
        ok: false,
        reason: "bad-moves",
        atMove: -1,
      });
    }
  });

  it("fails the whole round on one unreadable entry, and says where", () => {
    // Skipping it would score a game that differs from the one submitted, which
    // is the same as making one up.
    expect(verifyRound(RULES, 1, [1, "two"])).toEqual({
      ok: false,
      reason: "bad-moves",
      atMove: 1,
    });
  });

  it("refuses a move the board does not allow, and says where", () => {
    expect(verifyRound(RULES, 1, [1, 0])).toEqual({
      ok: false,
      reason: "illegal-move",
      atMove: 1,
    });
  });

  it("refuses a round that carries on past the end of the game", () => {
    expect(verifyRound(RULES, 1, [1, 1, 1, 1])).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: 3,
    });
  });

  it("refuses a submission too large to replay before replaying any of it", () => {
    const flood = new Array<number>(RULES.maxMoves + 1).fill(1);
    expect(verifyRound(RULES, 1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: RULES.maxMoves,
    });
  });
});
