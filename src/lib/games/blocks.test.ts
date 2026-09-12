import { describe, expect, it } from "vitest";
import {
  BLOCKS_RULES,
  CELL_POINTS,
  LINE_POINTS,
  MAX_MOVES,
  SHAPES,
  SIZE,
  TRAY,
  createBlocks,
  fits,
} from "@/lib/games/blocks";
import { verifyRound } from "@/lib/games/engine";
import { playBlocks } from "@/test/players";

const EMPTY = new Array<boolean>(SIZE * SIZE).fill(false);

/** A shape by its footprint, so a test can name the piece it means. */
function shapeOf(width: number, height: number, cells: number): number {
  const index = SHAPES.findIndex(
    (shape) =>
      shape.length === cells &&
      Math.max(...shape.map(({ x }) => x)) + 1 === width &&
      Math.max(...shape.map(({ y }) => y)) + 1 === height,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe("the pieces", () => {
  it("are drawn from their own pictures", () => {
    // The drawings are the source. If a row of "#" ever stopped becoming that
    // many cells, every shape in the game would be quietly wrong.
    expect(SHAPES[shapeOf(1, 1, 1)]).toEqual([{ x: 0, y: 0 }]);
    expect(SHAPES[shapeOf(2, 2, 4)]).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
  });

  it("all fit on the board somewhere", () => {
    for (const shape of SHAPES) {
      expect(shape.length).toBeGreaterThan(0);
      expect(Math.max(...shape.map(({ x }) => x))).toBeLessThan(SIZE);
      expect(Math.max(...shape.map(({ y }) => y))).toBeLessThan(SIZE);
    }
  });
});

describe("whether a piece fits", () => {
  const wide = SHAPES[shapeOf(4, 1, 4)]!;

  it("takes an empty square on an empty board", () => {
    expect(fits(EMPTY, wide, 0)).toBe(true);
  });

  it("refuses a piece that would hang off the edge", () => {
    // Column five leaves three squares, and the piece wants four.
    expect(fits(EMPTY, wide, 5)).toBe(false);
    expect(fits(EMPTY, SHAPES[shapeOf(1, 4, 4)]!, (SIZE - 2) * SIZE)).toBe(false);
  });

  it("refuses a square that is already taken", () => {
    const board = [...EMPTY];
    board[2] = true;
    expect(fits(board, wide, 0)).toBe(false);
    expect(fits(board, wide, 3)).toBe(true);
  });

  it("refuses a square that is not on the board", () => {
    for (const cell of [-1, SIZE * SIZE, 1.5, Number.NaN]) {
      expect(fits(EMPTY, wide, cell)).toBe(false);
    }
  });
});

describe("the opening", () => {
  it("deals three pieces onto an empty board", () => {
    const state = createBlocks(9).state();
    expect(state.board.some(Boolean)).toBe(false);
    expect(state.tray).toHaveLength(TRAY);
    expect(state.tray.every((slot) => slot !== null)).toBe(true);
    expect(state.over).toBe(false);
  });

  it("deals the same pieces for the same seed, and different ones otherwise", () => {
    expect(createBlocks(4).state().tray).toEqual(createBlocks(4).state().tray);
    const dealt = new Set([1, 2, 3, 4, 5].map((seed) => createBlocks(seed).state().tray.join()));
    expect(dealt.size).toBeGreaterThan(1);
  });
});

describe("placing a piece", () => {
  it("fills its squares and scores one a square", () => {
    const game = createBlocks(9);
    const held = game.state().tray[0]!;

    expect(game.play({ piece: 0, cell: 0 })).toBe(true);
    const after = game.state();
    expect(after.board.filter(Boolean)).toHaveLength(SHAPES[held]!.length);
    expect(after.score).toBe(SHAPES[held]!.length * CELL_POINTS);
    expect(after.tray[0]).toBeNull();
  });

  it("refuses a slot that is empty or does not exist", () => {
    const game = createBlocks(9);
    game.play({ piece: 0, cell: 0 });

    expect(game.play({ piece: 0, cell: 40 })).toBe(false);
    for (const piece of [-1, TRAY, 1.5]) {
      expect(game.play({ piece, cell: 40 })).toBe(false);
    }
  });

  it("refuses a placement that overlaps what is already down", () => {
    const game = createBlocks(9);
    game.play({ piece: 0, cell: 0 });
    // Same corner, and something is already in it.
    expect(game.play({ piece: 1, cell: 0 })).toBe(false);
  });

  it("refills the tray only once all three are gone", () => {
    const game = createBlocks(9);
    let placed = 0;

    for (let piece = 0; piece < TRAY; piece += 1) {
      const { board, tray } = game.state();
      const shape = SHAPES[tray[piece]!]!;
      const cell = [...Array(SIZE * SIZE).keys()].find((at) => fits(board, shape, at));
      if (cell === undefined) break;

      game.play({ piece, cell });
      placed += 1;
      const after = game.state();
      // Two placed means one slot left; the tray must not have refilled yet.
      if (placed < TRAY) expect(after.tray.filter((slot) => slot === null)).toHaveLength(placed);
    }

    expect(placed).toBe(TRAY);
    expect(game.state().tray.every((slot) => slot !== null)).toBe(true);
  });
});

describe("clearing lines", () => {
  /** Plays real rounds and reports every move that emptied something. */
  function clears(seed: number) {
    const round = playBlocks(seed);
    const game = createBlocks(seed);
    const found: { lines: number; gained: number; cells: number }[] = [];

    for (const move of round.moves as { piece: number; cell: number }[]) {
      const before = game.state();
      const cells = SHAPES[before.tray[move.piece]!]!.length;
      game.play(move);
      const after = game.state();
      if (after.lines > before.lines) {
        found.push({
          lines: after.lines - before.lines,
          gained: after.score - before.score,
          cells,
        });
      }
    }
    return found;
  }

  it("empties a full row or column and pays for it", () => {
    const found = [1, 2, 3, 4].flatMap((seed) => clears(seed));
    expect(found.length).toBeGreaterThan(0);

    for (const clear of found) {
      // Squared, so two at once is worth four singles — the one decision in
      // the game worth thinking about.
      expect(clear.gained).toBe(clear.cells * CELL_POINTS + LINE_POINTS * clear.lines ** 2);
    }
  });

  it("never leaves a full line on the board", () => {
    const round = playBlocks(7);
    const game = createBlocks(7);
    for (const move of round.moves as { piece: number; cell: number }[]) {
      game.play(move);
      const { board } = game.state();
      for (let index = 0; index < SIZE; index += 1) {
        const row = board.slice(index * SIZE, index * SIZE + SIZE);
        expect(row.every(Boolean)).toBe(false);
      }
    }
  });
});

describe("the end", () => {
  it("comes when nothing in hand fits anywhere", () => {
    const round = playBlocks(2024);
    expect(round.over).toBe(true);
    expect(round.score).toBeGreaterThan(0);

    const game = createBlocks(2024);
    for (const move of round.moves as { piece: number; cell: number }[]) game.play(move);

    const { board, tray } = game.state();
    for (const slot of tray) {
      if (slot === null) continue;
      for (let cell = 0; cell < SIZE * SIZE; cell += 1) {
        expect(fits(board, SHAPES[slot]!, cell)).toBe(false);
      }
    }
    expect(game.play({ piece: 0, cell: 0 })).toBe(false);
  });
});

describe("replaying a round", () => {
  it("reaches the score the player saw", () => {
    const round = playBlocks(2024);
    expect(verifyRound(BLOCKS_RULES, 2024, round.moves)).toEqual({
      ok: true,
      score: round.score,
      moves: round.moves.length,
      best: round.best,
    });
  });

  it("refuses a round padded past the end", () => {
    const round = playBlocks(2024);
    const padded = verifyRound(BLOCKS_RULES, 2024, [...round.moves, { piece: 0, cell: 0 }]);
    expect(padded).toEqual({ ok: false, reason: "illegal-move", atMove: round.moves.length });
  });

  it("refuses a move that is not a placement", () => {
    for (const move of [0, "0", null, { piece: 0 }, { cell: 0 }, { piece: "0", cell: 0 }]) {
      const result = verifyRound(BLOCKS_RULES, 1, [move]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("bad-moves");
    }
  });

  it("refuses someone else's round", () => {
    const round = playBlocks(2024);
    const borrowed = verifyRound(BLOCKS_RULES, 31337, round.moves);
    // A different deal, so the list either stops fitting or scores differently.
    if (borrowed.ok) expect(borrowed.score).not.toBe(round.score);
  });

  it("cannot be submitted with more moves than the game allows", () => {
    const flood = new Array(MAX_MOVES + 1).fill({ piece: 0, cell: 0 });
    expect(verifyRound(BLOCKS_RULES, 1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: MAX_MOVES,
    });
  });
});
