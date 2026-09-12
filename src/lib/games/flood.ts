import { below, rng } from "@/lib/games/rng";
import { type Engine, type GameRules } from "@/lib/games/engine";

/**
 * Flood — the whole board, one colour, before the moves run out.
 *
 * The region in the top-left corner is yours. Pick a colour and it becomes that
 * colour, swallowing every touching tile that already was. Pick well and the
 * region grows by thirty tiles; pick badly and it grows by two.
 *
 * It is here because it is the opposite of the other games on the shelf: no
 * reflexes, no memory, nothing moving. A round is twenty-odd deliberate
 * decisions and it can be played one-handed on a bus, which is most of what
 * this site's players are going to be doing.
 *
 * The generous part of the design is the move limit. Solving a board this size
 * optimally takes around twenty moves and nobody does it by eye, so the limit
 * is set where a careful player finishes with a few to spare — the spare moves
 * are where the points are, and running out is a real, survivable loss rather
 * than the usual outcome.
 */

export const SIZE = 12;
export const COLOURS = 6;
export const MOVE_LIMIT = 26;

/** A filled tile is worth this much at the end, finished or not. */
export const TILE_POINTS = 5;
/** A move you did not need to spend is worth ten tiles. */
export const SPARE_MOVE_POINTS = 50;

export type FloodState = {
  /** A colour index per cell, row-major. */
  board: readonly number[];
  /**
   * Which cells are joined to the corner — your patch.
   *
   * The engine works this out anyway to score the round, and a player who
   * cannot see where their patch ends is guessing rather than choosing. So it
   * comes out with the board rather than being recomputed by the screen.
   */
  owned: readonly boolean[];
  moves: number;
  /** Moves still in hand. */
  left: number;
  /** Tiles currently joined to the corner. */
  filled: number;
  won: boolean;
  score: number;
  over: boolean;
  /** The headline stat: how much of the board was taken. */
  best: number;
};

/** Every cell joined to the corner through same-coloured neighbours. */
function region(board: readonly number[]): number[] {
  const colour = board[0]!;
  const seen = new Set<number>([0]);
  const queue = [0];

  while (queue.length > 0) {
    const at = queue.pop()!;
    const x = at % SIZE;
    const y = Math.floor(at / SIZE);

    const neighbours = [
      x > 0 ? at - 1 : -1,
      x < SIZE - 1 ? at + 1 : -1,
      y > 0 ? at - SIZE : -1,
      y < SIZE - 1 ? at + SIZE : -1,
    ];
    for (const neighbour of neighbours) {
      if (neighbour < 0 || seen.has(neighbour)) continue;
      if (board[neighbour] !== colour) continue;
      seen.add(neighbour);
      queue.push(neighbour);
    }
  }
  return [...seen];
}

function mask(cells: readonly number[]): boolean[] {
  const owned = new Array<boolean>(SIZE * SIZE).fill(false);
  for (const cell of cells) owned[cell] = true;
  return owned;
}

function score(filled: number, left: number, won: boolean): number {
  return filled * TILE_POINTS + (won ? left * SPARE_MOVE_POINTS : 0);
}

export function createFlood(seed: number): Engine<number, FloodState> {
  const next = rng(seed);
  const board: number[] = [];
  for (let index = 0; index < SIZE * SIZE; index += 1) board.push(below(COLOURS, next));

  let moves = 0;
  let patch = region(board);
  let won = false;
  let over = false;

  return {
    state: () => ({
      board: [...board],
      owned: mask(patch),
      moves,
      left: MOVE_LIMIT - moves,
      filled: patch.length,
      won,
      over,
      score: score(patch.length, MOVE_LIMIT - moves, won),
      best: patch.length,
    }),
    play: (colour) => {
      if (over) return false;
      if (!Number.isInteger(colour) || colour < 0 || colour >= COLOURS) return false;
      // Picking the colour the region already is changes nothing. The board
      // greys that swatch out, so a client cannot send it by accident.
      if (colour === board[0]) return false;

      for (const cell of patch) board[cell] = colour;
      moves += 1;
      patch = region(board);

      if (patch.length === SIZE * SIZE) {
        won = true;
        over = true;
      } else if (moves >= MOVE_LIMIT) {
        over = true;
      }
      return true;
    },
  };
}

export const FLOOD_RULES: GameRules<number> = {
  maxMoves: MOVE_LIMIT,
  create: createFlood,
  parse: (value) => (typeof value === "number" && Number.isInteger(value) ? value : null),
};
