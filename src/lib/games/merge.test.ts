import { describe, expect, it } from "vitest";
import { SIZE, type Board, best, isOver, move, rng, slide, spawn, start } from "@/lib/games/merge";
import { MAX_MOVES, createGame, replay } from "@/lib/games/play";
import type { Direction } from "@/lib/games/merge";

/** Reads a board from rows, so the tests are legible. */
function board(...rows: number[][]): Board {
  expect(rows).toHaveLength(SIZE);
  return rows.flat();
}

describe("sliding a row", () => {
  it("packs towards the left", () => {
    expect(slide([0, 2, 0, 4]).row).toEqual([2, 4, 0, 0]);
  });

  it("merges a matching pair and scores the result", () => {
    expect(slide([2, 2, 0, 0])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
  });

  it("merges each tile once per move", () => {
    // The rule people get wrong. [2,2,4] becomes [4,4] and stops — if the new 4
    // could merge again, one swipe would cascade a row into a single tile.
    expect(slide([2, 2, 4, 0])).toEqual({ row: [4, 4, 0, 0], gained: 4 });
    expect(slide([4, 4, 8, 0])).toEqual({ row: [8, 8, 0, 0], gained: 8 });
  });

  it("merges two separate pairs in one move", () => {
    expect(slide([2, 2, 4, 4])).toEqual({ row: [4, 8, 0, 0], gained: 12 });
  });

  it("leaves unequal neighbours alone", () => {
    expect(slide([2, 4, 8, 16])).toEqual({ row: [2, 4, 8, 16], gained: 0 });
  });

  it("closes gaps before deciding what touches what", () => {
    expect(slide([2, 0, 0, 2])).toEqual({ row: [4, 0, 0, 0], gained: 4 });
  });
});

describe("moving the board", () => {
  const one = board([2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);

  it("collapses left", () => {
    expect(move(one, "left").board.slice(0, 4)).toEqual([4, 0, 0, 0]);
  });

  it("collapses right", () => {
    expect(move(one, "right").board.slice(0, 4)).toEqual([0, 0, 0, 4]);
  });

  it("collapses down a column", () => {
    const column = board([2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    const after = move(column, "down").board;
    expect(after[12]).toBe(4);
    expect(after[0]).toBe(0);
  });

  it("collapses up a column", () => {
    const column = board([0, 0, 0, 0], [0, 0, 0, 0], [2, 0, 0, 0], [2, 0, 0, 0]);
    expect(move(column, "up").board[0]).toBe(4);
  });

  it("reports a move that changes nothing", () => {
    // This is what stops a no-op from spawning a free tile, which would let
    // someone farm the board by swiping into a wall.
    const packed = board([2, 4, 8, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]);
    expect(move(packed, "left").moved).toBe(false);
    expect(move(packed, "right").moved).toBe(true);
  });
});

describe("game over", () => {
  it("is not over while a cell is empty", () => {
    expect(isOver(board([2, 4, 8, 16], [32, 64, 128, 256], [2, 4, 8, 16], [32, 64, 128, 0]))).toBe(
      false,
    );
  });

  it("is not over while two neighbours match", () => {
    expect(isOver(board([2, 2, 8, 16], [32, 64, 128, 256], [2, 4, 8, 16], [32, 64, 128, 2]))).toBe(
      false,
    );
  });

  it("is over on a full board with no pair", () => {
    expect(isOver(board([2, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]))).toBe(true);
  });

  it("sees a vertical pair, not just a horizontal one", () => {
    expect(isOver(board([2, 4, 8, 16], [2, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]))).toBe(false);
  });
});

describe("the seeded generator", () => {
  it("gives the same stream for the same seed", () => {
    // Everything downstream rests on this: it is what lets the server replay a
    // browser's game and get the same board.
    const a = rng(12345);
    const b = rng(12345);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("gives a different stream for a different seed", () => {
    expect(rng(1)()).not.toBe(rng(2)());
  });

  it("stays inside [0, 1)", () => {
    const next = rng(99);
    for (let index = 0; index < 500; index += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("spawning", () => {
  it("fills exactly one empty cell", () => {
    const before = board([2, 4, 8, 16], [32, 64, 128, 256], [2, 4, 8, 16], [32, 64, 128, 0]);
    const after = spawn(before, rng(7));
    expect(after.filter((value) => value === 0)).toHaveLength(0);
  });

  it("puts down a 2 or a 4, nothing else", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const after = spawn(board([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), rng(seed));
      const placed = after.filter((value) => value !== 0);
      expect(placed).toHaveLength(1);
      expect([2, 4]).toContain(placed[0]);
    }
  });

  it("does nothing to a full board", () => {
    const full = board([2, 4, 8, 16], [4, 8, 16, 2], [8, 16, 2, 4], [16, 2, 4, 8]);
    expect(spawn(full, rng(1))).toEqual(full);
  });

  it("opens with two tiles", () => {
    expect(start(42).board.filter((value) => value !== 0)).toHaveLength(2);
  });
});

describe("replaying a game on the server", () => {
  const ORDER: Direction[] = ["left", "up", "right", "down"];

  /**
   * Plays a real game the way a browser would, collecting the moves.
   *
   * `play` leaves the game untouched when it returns false, so trying
   * directions in order until one lands is safe — no probe copy needed.
   */
  function playFor(seed: number, rounds: number) {
    const game = createGame(seed);
    const moves: Direction[] = [];

    for (let round = 0; round < rounds; round += 1) {
      const direction = ORDER.find((candidate) => game.play(candidate));
      if (!direction) break;
      moves.push(direction);
    }
    return { moves, state: game.state() };
  }

  /** Plays until the board is dead. */
  function playToEnd(seed: number) {
    return playFor(seed, MAX_MOVES);
  }

  it("reaches the same score the player saw", () => {
    const { moves, state } = playFor(2024, 30);
    const result = replay(2024, moves);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score).toBe(state.score);
    expect(result.moves).toBe(moves.length);
  });

  it("gives a different score for a different seed, on the same moves", () => {
    // The seed is part of what is being checked. Replaying someone else's move
    // list against your own seed does not reproduce their score.
    const { moves } = playFor(2024, 30);
    const mine = replay(2024, moves);
    const theirs = replay(9999, moves);
    expect(mine.ok).toBe(true);
    // Either it desyncs into an illegal move or it scores differently; both are
    // a refusal to accept the borrowed game.
    if (theirs.ok && mine.ok) expect(theirs.score).not.toBe(mine.score);
  });

  it("refuses a move list that carries on past the end of the game", () => {
    // A real client has the board in front of it and cannot produce a move that
    // does nothing, so one in the list means the list was assembled by
    // something else. Padding a finished game is the cheapest way to try it.
    const { moves } = playToEnd(2024);
    expect(replay(2024, moves).ok).toBe(true);

    const padded = replay(2024, [...moves, "left"]);
    expect(padded.ok).toBe(false);
    if (padded.ok) return;
    expect(padded.reason).toBe("illegal-move");
    expect(padded.atMove).toBe(moves.length);
  });

  it("plays a whole game to a dead board", () => {
    // Guards the loop above: if the game could never end, the padding test
    // would be asserting nothing.
    const { moves, state } = playToEnd(2024);
    expect(state.over).toBe(true);
    expect(moves.length).toBeGreaterThan(20);
    expect(state.score).toBeGreaterThan(0);
  });

  it("refuses a submission too large to replay", () => {
    const flood = new Array<Direction>(MAX_MOVES + 1).fill("left");
    expect(replay(1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: MAX_MOVES,
    });
  });

  it("scores an empty game as zero rather than failing", () => {
    expect(replay(5, [])).toEqual({ ok: true, score: 0, moves: 0, best: expect.any(Number) });
  });
});

describe("best tile", () => {
  it("is the highest on the board", () => {
    expect(best(board([2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]))).toBe(16);
    expect(best(board([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]))).toBe(0);
  });
});
