import { describe, expect, it } from "vitest";
import {
  COLOURS,
  FLOOD_RULES,
  MOVE_LIMIT,
  SIZE,
  SPARE_MOVE_POINTS,
  TILE_POINTS,
  createFlood,
} from "@/lib/games/flood";
import { verifyRound } from "@/lib/games/engine";
import { playFlood } from "@/test/players";

/** Any colour other than the one the corner is now — always a legal move. */
function otherColour(current: number): number {
  return (current + 1) % COLOURS;
}

describe("dealing a board", () => {
  it("fills every cell with one of the colours", () => {
    const { board } = createFlood(12).state();
    expect(board).toHaveLength(SIZE * SIZE);
    for (const colour of board) {
      expect(Number.isInteger(colour)).toBe(true);
      expect(colour).toBeGreaterThanOrEqual(0);
      expect(colour).toBeLessThan(COLOURS);
    }
  });

  it("marks the corner patch, and only tiles joined to it", () => {
    const { owned, filled, board } = createFlood(12).state();
    expect(owned).toHaveLength(SIZE * SIZE);
    expect(owned[0]).toBe(true);
    expect(owned.filter(Boolean)).toHaveLength(filled);
    // Anything owned is the corner's colour. The reverse is not true: a tile of
    // the same colour on the far side of the board is not yours yet.
    owned.forEach((mine, cell) => {
      if (mine) expect(board[cell]).toBe(board[0]);
    });
  });

  it("opens with the corner patch already counted", () => {
    const state = createFlood(12).state();
    expect(state.filled).toBeGreaterThanOrEqual(1);
    expect(state.moves).toBe(0);
    expect(state.left).toBe(MOVE_LIMIT);
    expect(state.over).toBe(false);
  });

  it("deals the same board for the same seed, and a different one otherwise", () => {
    expect(createFlood(5).state().board).toEqual(createFlood(5).state().board);
    expect(createFlood(5).state().board).not.toEqual(createFlood(6).state().board);
  });
});

describe("taking a colour", () => {
  it("refuses the colour the corner already is", () => {
    // Nothing would change, so the board greys the swatch out and a submission
    // containing it did not come from a board.
    const game = createFlood(3);
    expect(game.play(game.state().board[0]!)).toBe(false);
    expect(game.state().moves).toBe(0);
  });

  it("refuses a colour that does not exist", () => {
    const game = createFlood(3);
    for (const colour of [-1, COLOURS, 1.5, Number.NaN]) {
      expect(game.play(colour)).toBe(false);
    }
  });

  it("spends a move and never loses ground", () => {
    const game = createFlood(3);
    const before = game.state();
    expect(game.play(otherColour(before.board[0]!))).toBe(true);

    const after = game.state();
    expect(after.moves).toBe(1);
    expect(after.left).toBe(MOVE_LIMIT - 1);
    expect(after.filled).toBeGreaterThanOrEqual(before.filled);
    expect(after.owned.filter(Boolean)).toHaveLength(after.filled);
    expect(after.board[0]).toBe(otherColour(before.board[0]!));
  });

  it("repaints the whole corner patch, not just one tile", () => {
    const game = createFlood(3);
    const before = game.state();
    const taken = otherColour(before.board[0]!);
    game.play(taken);

    const after = game.state();
    const repainted = after.board.filter((colour, index) => colour !== before.board[index]);
    expect(repainted.length).toBeGreaterThanOrEqual(before.filled - 1);
    expect(repainted.every((colour) => colour === taken)).toBe(true);
  });
});

describe("scoring", () => {
  it("counts the tiles taken while the round is still going", () => {
    const game = createFlood(3);
    game.play(otherColour(game.state().board[0]!));
    const state = game.state();
    expect(state.score).toBe(state.filled * TILE_POINTS);
  });

  it("pays for the moves a finished board did not need", () => {
    const round = playFlood(2024);
    const game = createFlood(2024);
    for (const move of round.moves as number[]) game.play(move);

    const state = game.state();
    expect(state.over).toBe(true);
    // The limit is set where a careful player finishes with moves in hand. If
    // this ever stops being true, the limit is wrong, not the test.
    expect(state.won).toBe(true);
    expect(state.filled).toBe(SIZE * SIZE);
    expect(state.owned.every(Boolean)).toBe(true);
    expect(state.score).toBe(SIZE * SIZE * TILE_POINTS + state.left * SPARE_MOVE_POINTS);
  });

  it("pays no bonus for a board that was not finished", () => {
    // Always picking the next colour along is a terrible strategy, which is the
    // point: it runs the limit out.
    const game = createFlood(8);
    while (!game.state().over) game.play(otherColour(game.state().board[0]!));

    const state = game.state();
    expect(state.moves).toBe(MOVE_LIMIT);
    expect(state.left).toBe(0);
    expect(state.won).toBe(false);
    expect(state.score).toBe(state.filled * TILE_POINTS);
  });

  it("refuses any move once the round is over", () => {
    const game = createFlood(8);
    while (!game.state().over) game.play(otherColour(game.state().board[0]!));
    expect(game.play(otherColour(game.state().board[0]!))).toBe(false);
  });
});

describe("replaying a round", () => {
  it("reaches the score the player saw", () => {
    const round = playFlood(2024);
    expect(verifyRound(FLOOD_RULES, 2024, round.moves)).toEqual({
      ok: true,
      score: round.score,
      moves: round.moves.length,
      best: round.best,
    });
  });

  it("refuses a round padded past the finish", () => {
    const round = playFlood(2024);
    const padded = verifyRound(FLOOD_RULES, 2024, [...round.moves, 0]);
    expect(padded).toEqual({ ok: false, reason: "illegal-move", atMove: round.moves.length });
  });

  it("refuses someone else's round", () => {
    const round = playFlood(2024);
    const borrowed = verifyRound(FLOOD_RULES, 31337, round.moves);
    // A different deal, so the list either hits a colour that is already the
    // corner's or scores differently. Both are a refusal.
    if (borrowed.ok) expect(borrowed.score).not.toBe(round.score);
  });

  it("cannot be submitted with more moves than the game allows", () => {
    const flood = new Array<number>(MOVE_LIMIT + 1).fill(0);
    expect(verifyRound(FLOOD_RULES, 1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: MOVE_LIMIT,
    });
  });
});
