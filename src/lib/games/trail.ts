import { type Direction, STEP, isDirection, opposite } from "@/lib/games/direction";
import { below, rng } from "@/lib/games/rng";
import { type Engine, type GameRules } from "@/lib/games/engine";

/**
 * Trail — the snake game, with one decision that shapes everything else: a move
 * is one tick, not one turn.
 *
 * The obvious encoding is to submit the turns ("left at tick 40, up at tick 52")
 * and let the server fill in the ticks between. It is smaller, and it is worse:
 * the gaps are then the server's inference rather than the player's input, and
 * every rule about what happens in a gap has to be agreed twice. Sending the
 * heading for every tick makes the submitted list *be* the game — the same list
 * the browser played, replayed exactly, with no interpolation anywhere.
 *
 * It costs a few kilobytes on a long round, which is a fine price for having
 * one description of what happened.
 *
 * Note what this means for pace: the speed the snake moves at is presentation,
 * decided by the browser's timer. The rules know only ticks, so a slow player
 * and a fast one are scored identically, and speeding the timer up buys
 * nothing.
 */

export const SIZE = 13;

/**
 * Ticks, not seconds — about nine minutes at the speed the board runs. A round
 * cannot last forever anyway (the snake is always one wall away from dying),
 * but the replay needs a ceiling it can state.
 */
export const MAX_TICKS = 4_000;

/** A fruit is worth this, plus one for every segment already earned. */
export const FRUIT_POINTS = 10;

/** Where the snake starts: three segments, mid-board, heading right. */
const START_LENGTH = 3;

export type TrailState = {
  /** Cell indexes, head first. */
  snake: readonly number[];
  /** Cell index, or -1 when the board is full and there is nowhere to put one. */
  fruit: number;
  heading: Direction;
  score: number;
  over: boolean;
  /** The longest the trail got, which is the length when it stopped. */
  best: number;
};

function cell(x: number, y: number): number {
  return y * SIZE + x;
}

/**
 * Puts a fruit on a free cell.
 *
 * Returns -1 for a full board: that is the perfect game, not an error, and the
 * caller ends the round there rather than looping for a cell that will never
 * come free.
 */
function placeFruit(snake: readonly number[], next: () => number): number {
  const taken = new Set(snake);
  const free: number[] = [];
  for (let index = 0; index < SIZE * SIZE; index += 1) {
    if (!taken.has(index)) free.push(index);
  }
  if (free.length === 0) return -1;
  return free[below(free.length, next)]!;
}

export function createTrail(seed: number): Engine<Direction, TrailState> {
  const next = rng(seed);
  const middle = Math.floor(SIZE / 2);

  let snake: number[] = [];
  for (let offset = 0; offset < START_LENGTH; offset += 1) {
    snake.push(cell(middle - offset, middle));
  }

  let heading: Direction = "right";
  let fruit = placeFruit(snake, next);
  let score = 0;
  let over = false;

  return {
    state: () => ({ snake, fruit, heading, score, over, best: snake.length }),
    play: (direction) => {
      if (over) return false;
      // A reversal is the one input a player can press that the game refuses.
      // The browser drops it before it reaches here, so one arriving means the
      // list did not come from a board.
      if (direction === opposite(heading)) return false;

      heading = direction;

      const head = snake[0]!;
      const x = (head % SIZE) + STEP[direction].x;
      const y = Math.floor(head / SIZE) + STEP[direction].y;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
        // Into a wall. A legal move — the last one.
        over = true;
        return true;
      }

      const target = cell(x, y);
      const eating = target === fruit;
      // The tail vacates its cell on the same tick, so moving into it is fine —
      // unless the fruit is being eaten, in which case nothing vacates.
      const body = eating ? snake : snake.slice(0, -1);
      if (body.includes(target)) {
        over = true;
        return true;
      }

      snake = [target, ...body];

      if (eating) {
        // Longer trail, bigger fruit. It is the only reason to keep taking the
        // risk once the board is crowded.
        score += FRUIT_POINTS + snake.length;
        fruit = placeFruit(snake, next);
        if (fruit < 0) over = true;
      }
      return true;
    },
  };
}

export const TRAIL_RULES: GameRules<Direction> = {
  maxMoves: MAX_TICKS,
  create: createTrail,
  parse: (value) => (isDirection(value) ? value : null),
};
