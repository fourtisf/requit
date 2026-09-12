import { below, rng } from "@/lib/games/rng";
import { type Engine, type GameRules } from "@/lib/games/engine";

/**
 * Blocks — pieces go on the board, full lines leave it.
 *
 * It is here because of what the other games taught us the hard way: a player
 * who has to be told the rule before the screen makes sense has already
 * bounced. Here the pieces are drawn under the board and the board has holes in
 * it, and that is the whole explanation. It is also, by downloads, the most
 * played shape of game in the world right now, which is not a coincidence.
 *
 * No gravity, no timer, no rotation. A piece is placed where it fits or not at
 * all, which keeps the rules replayable: the same seed deals the same pieces in
 * the same order, and a placement either fits the board or it is refused.
 */

export const SIZE = 8;
/** Pieces in hand. The tray refills only when all three are gone. */
export const TRAY = 3;

/** A placed cell is worth this, a cleared line ten times more. */
export const CELL_POINTS = 1;
export const LINE_POINTS = 10;

/**
 * A ceiling on a submitted round. A board this size cannot absorb more than a
 * few hundred pieces however well it is played.
 */
export const MAX_MOVES = 1_000;

/**
 * The pieces, drawn rather than described.
 *
 * Writing them as rows of characters means the shape in the source is the shape
 * on the board, which is the only way this list stays checkable by eye.
 */
const DRAWINGS: readonly (readonly string[])[] = [
  ["#"],
  ["##"],
  ["#", "#"],
  ["###"],
  ["#", "#", "#"],
  ["####"],
  ["#", "#", "#", "#"],
  ["##", "##"],
  ["###", "###", "###"],
  ["#.", "##"],
  [".#", "##"],
  ["##", "#."],
  ["##", ".#"],
  ["###", "..#"],
  ["###", "#.."],
];

export type Offset = { x: number; y: number };
export type Shape = readonly Offset[];

export const SHAPES: readonly Shape[] = DRAWINGS.map((rows) => {
  const cells: Offset[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((mark, x) => {
      if (mark === "#") cells.push({ x, y });
    });
  });
  return cells;
});

export type BlocksMove = { piece: number; cell: number };

export type BlocksState = {
  /** True where a cell is filled, row-major. */
  board: readonly boolean[];
  /** A shape index per tray slot; null once that piece has been used. */
  tray: readonly (number | null)[];
  score: number;
  /** Rows and columns cleared so far — the round's second number. */
  lines: number;
  over: boolean;
  best: number;
};

/**
 * Whether a shape can be laid down with its top-left corner on this cell.
 *
 * Exported because the board needs the same answer the rules give: a square
 * that will not take the selected piece should not look like one that will.
 * One implementation, two readers.
 */
export function fits(board: readonly boolean[], shape: Shape, cell: number): boolean {
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) return false;

  const left = cell % SIZE;
  const top = Math.floor(cell / SIZE);
  return shape.every(({ x, y }) => {
    const column = left + x;
    const row = top + y;
    if (column >= SIZE || row >= SIZE) return false;
    return !board[row * SIZE + column];
  });
}

/** Every cell this shape would occupy from here. Only valid when it fits. */
export function coverage(shape: Shape, cell: number): number[] {
  const left = cell % SIZE;
  const top = Math.floor(cell / SIZE);
  return shape.map(({ x, y }) => (top + y) * SIZE + (left + x));
}

function full(board: readonly boolean[]): { rows: number[]; columns: number[] } {
  const rows: number[] = [];
  const columns: number[] = [];

  for (let index = 0; index < SIZE; index += 1) {
    let row = true;
    let column = true;
    for (let step = 0; step < SIZE; step += 1) {
      if (!board[index * SIZE + step]) row = false;
      if (!board[step * SIZE + index]) column = false;
    }
    if (row) rows.push(index);
    if (column) columns.push(index);
  }
  return { rows, columns };
}

export function createBlocks(seed: number): Engine<BlocksMove, BlocksState> {
  const next = rng(seed);
  const board = new Array<boolean>(SIZE * SIZE).fill(false);
  const deal = () => below(SHAPES.length, next);

  let tray: (number | null)[] = [deal(), deal(), deal()];
  let score = 0;
  let lines = 0;
  let over = false;

  /** Over when not one piece still in hand has anywhere left to go. */
  const stuck = (): boolean =>
    !tray.some((shape) => {
      if (shape === null) return false;
      for (let cell = 0; cell < SIZE * SIZE; cell += 1) {
        if (fits(board, SHAPES[shape]!, cell)) return true;
      }
      return false;
    });

  return {
    state: () => ({
      board: [...board],
      tray: [...tray],
      score,
      lines,
      over,
      best: lines,
    }),
    play: ({ piece, cell }) => {
      if (over) return false;
      if (!Number.isInteger(piece) || piece < 0 || piece >= TRAY) return false;

      const shape = tray[piece];
      if (shape === null || shape === undefined) return false;
      if (!fits(board, SHAPES[shape]!, cell)) return false;

      for (const filled of coverage(SHAPES[shape]!, cell)) board[filled] = true;
      score += SHAPES[shape]!.length * CELL_POINTS;

      // Rows and columns are found before any of them is emptied: clearing as
      // we go would let an already-counted line be counted again through a cell
      // a later clear removed.
      const { rows, columns } = full(board);
      for (const row of rows) {
        for (let step = 0; step < SIZE; step += 1) board[row * SIZE + step] = false;
      }
      for (const column of columns) {
        for (let step = 0; step < SIZE; step += 1) board[step * SIZE + column] = false;
      }

      const cleared = rows.length + columns.length;
      if (cleared > 0) {
        // Squared, so two lines at once is worth four singles. It is the one
        // decision in the game worth thinking about.
        score += LINE_POINTS * cleared * cleared;
        lines += cleared;
      }

      tray[piece] = null;
      if (tray.every((slot) => slot === null)) tray = [deal(), deal(), deal()];

      if (stuck()) over = true;
      return true;
    },
  };
}

export const BLOCKS_RULES: GameRules<BlocksMove> = {
  maxMoves: MAX_MOVES,
  create: createBlocks,
  parse: (value) => {
    if (value === null || typeof value !== "object") return null;
    const move = value as { piece?: unknown; cell?: unknown };
    if (!Number.isInteger(move.piece) || !Number.isInteger(move.cell)) return null;
    return { piece: move.piece as number, cell: move.cell as number };
  },
};
