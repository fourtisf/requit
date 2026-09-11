/**
 * The merge game's rules, as pure functions.
 *
 * Everything that decides a score lives here rather than in the component, for
 * one reason: this is the first thing in the product where a member's own
 * device produces a number that turns into money. A score computed in the
 * browser is a score anyone can type into a console, so the rules have to be
 * runnable on the server too — the same functions, over the same moves, with
 * the client's claim checked against the server's replay.
 *
 * So: no React, no randomness of its own, no Date.now(). The board and the seed
 * go in, the next board comes out, and the same inputs always give the same
 * result. lib/games/verify.ts depends on that.
 */

export const SIZE = 4;
/** Reaching this is the win. The board keeps going afterwards. */
export const TARGET = 2048;

/** Row-major, length SIZE * SIZE. 0 is an empty cell. */
export type Board = readonly number[];

export type Direction = "up" | "down" | "left" | "right";

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

export function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && (DIRECTIONS as readonly string[]).includes(value);
}

export function emptyBoard(): Board {
  return new Array<number>(SIZE * SIZE).fill(0);
}

/**
 * A seeded generator, so a game can be replayed move for move.
 *
 * mulberry32: small, fast, and — the part that matters here — identical in
 * every JavaScript runtime, which is what lets the server recompute a browser's
 * game exactly.
 */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Collapses one row to the left, merging equal neighbours once each.
 *
 * "Once each" is the rule people get wrong: [2,2,4] slides to [4,4] and stops.
 * The 4 that was just created must not merge again in the same move, or a
 * single swipe could cascade a row into one enormous tile.
 */
export function slide(row: readonly number[]): { row: number[]; gained: number } {
  const packed = row.filter((value) => value !== 0);
  const out: number[] = [];
  let gained = 0;

  for (let index = 0; index < packed.length; index += 1) {
    const value = packed[index]!;
    const next = packed[index + 1];
    if (next === value) {
      const merged = value * 2;
      out.push(merged);
      gained += merged;
      index += 1; // consumed, and the result is not eligible again this move
    } else {
      out.push(value);
    }
  }

  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

function rowsOf(board: Board, direction: Direction): number[][] {
  const rows: number[][] = [];
  for (let index = 0; index < SIZE; index += 1) {
    const row: number[] = [];
    for (let step = 0; step < SIZE; step += 1) {
      // Each direction is the same left-collapse read along a different axis.
      const position =
        direction === "left"
          ? index * SIZE + step
          : direction === "right"
            ? index * SIZE + (SIZE - 1 - step)
            : direction === "up"
              ? step * SIZE + index
              : (SIZE - 1 - step) * SIZE + index;
      row.push(board[position]!);
    }
    rows.push(row);
  }
  return rows;
}

function writeRows(rows: number[][], direction: Direction): Board {
  const board = new Array<number>(SIZE * SIZE).fill(0);
  rows.forEach((row, index) => {
    row.forEach((value, step) => {
      const position =
        direction === "left"
          ? index * SIZE + step
          : direction === "right"
            ? index * SIZE + (SIZE - 1 - step)
            : direction === "up"
              ? step * SIZE + index
              : (SIZE - 1 - step) * SIZE + index;
      board[position] = value;
    });
  });
  return board;
}

export type MoveResult = {
  board: Board;
  gained: number;
  /** False when nothing shifted — the move is not a move and spawns nothing. */
  moved: boolean;
};

export function move(board: Board, direction: Direction): MoveResult {
  const rows = rowsOf(board, direction);
  let gained = 0;
  const next = rows.map((row) => {
    const result = slide(row);
    gained += result.gained;
    return result.row;
  });

  const after = writeRows(next, direction);
  const moved = after.some((value, index) => value !== board[index]);
  return { board: after, gained, moved };
}

/**
 * Puts a new tile on a random empty cell. 2 nine times out of ten.
 *
 * Takes the generator rather than calling Math.random, so a replay lands the
 * tile in the same place.
 */
export function spawn(board: Board, next: () => number): Board {
  const empty: number[] = [];
  board.forEach((value, index) => {
    if (value === 0) empty.push(index);
  });
  if (empty.length === 0) return board;

  const cell = empty[Math.floor(next() * empty.length)]!;
  const out = [...board];
  out[cell] = next() < 0.9 ? 2 : 4;
  return out;
}

export function start(seed: number): { board: Board; seed: number } {
  const next = rng(seed);
  return { board: spawn(spawn(emptyBoard(), next), next), seed };
}

/** Over when the board is full and no neighbours match. */
export function isOver(board: Board): boolean {
  if (board.some((value) => value === 0)) return false;

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const value = board[row * SIZE + column]!;
      if (column + 1 < SIZE && board[row * SIZE + column + 1] === value) return false;
      if (row + 1 < SIZE && board[(row + 1) * SIZE + column] === value) return false;
    }
  }
  return true;
}

export function best(board: Board): number {
  return board.reduce((highest, value) => (value > highest ? value : highest), 0);
}
