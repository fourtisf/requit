import { type Direction, DIRECTIONS, STEP, opposite } from "@/lib/games/direction";
import { createGame } from "@/lib/games/play";
import { SIZE as TRAIL_SIZE, createTrail } from "@/lib/games/trail";
import { COLOURS, createFlood } from "@/lib/games/flood";
import { CARDS, createRecall } from "@/lib/games/recall";
import { SHAPES, SIZE as BLOCKS_SIZE, createBlocks, fits } from "@/lib/games/blocks";
import { createSpot } from "@/lib/games/spot";
import type { GameSlug } from "@/lib/games/catalog";

/**
 * Bots that play each game properly, for the tests.
 *
 * Tests about scoring want a real round — a move list a browser could actually
 * have produced — and hand-written ones stop being real the moment a rule
 * changes. These play by the rules through the same engines the site does, so a
 * test can assert "this round scores what the player saw" without knowing
 * anything about the game.
 *
 * None of them is trying to be good. A bot that played optimally would make the
 * tests depend on it staying optimal.
 */

export type Round = {
  moves: unknown[];
  score: number;
  best: number;
  over: boolean;
};

/** Merge: the first direction that shifts the board, until nothing does. */
export function playMerge(seed: number, limit = 2_000): Round {
  const game = createGame(seed);
  const moves: Direction[] = [];

  while (!game.state().over && moves.length < limit) {
    const played = DIRECTIONS.find((direction) => game.play(direction));
    if (!played) break;
    moves.push(played);
  }

  const state = game.state();
  return { moves, score: state.score, best: state.best, over: state.over };
}

/** Trail: head for the fruit, and do not walk into anything on the way. */
export function playTrail(seed: number, limit = 1_000): Round {
  const game = createTrail(seed);
  const moves: Direction[] = [];

  while (!game.state().over && moves.length < limit) {
    const { snake, fruit, heading } = game.state();
    const head = snake[0]!;
    const hx = head % TRAIL_SIZE;
    const hy = Math.floor(head / TRAIL_SIZE);
    const fx = fruit % TRAIL_SIZE;
    const fy = Math.floor(fruit / TRAIL_SIZE);

    const wanted: Direction[] = [];
    if (fx > hx) wanted.push("right");
    if (fx < hx) wanted.push("left");
    if (fy > hy) wanted.push("down");
    if (fy < hy) wanted.push("up");

    const safe = [...wanted, ...DIRECTIONS].find((direction) => {
      if (direction === opposite(heading)) return false;
      const x = hx + STEP[direction].x;
      const y = hy + STEP[direction].y;
      if (x < 0 || y < 0 || x >= TRAIL_SIZE || y >= TRAIL_SIZE) return false;
      const target = y * TRAIL_SIZE + x;
      // The tail moves off its cell on the same tick, unless the fruit is there
      // to grow into.
      const body = target === fruit ? snake : snake.slice(0, -1);
      return !body.includes(target);
    });

    // Cornered: carry straight on and take the consequences, which is what a
    // player does too.
    const move = safe ?? heading;
    game.play(move);
    moves.push(move);
  }

  const state = game.state();
  return { moves, score: state.score, best: state.best, over: state.over };
}

/**
 * Flood: whichever colour takes the most tiles this move.
 *
 * It measures a candidate by replaying the round with it rather than by
 * counting neighbours itself. Re-implementing the flood rule in the test bot
 * would mean a bug in the rules could be reproduced faithfully by the thing
 * meant to catch it.
 */
export function playFlood(seed: number): Round {
  const game = createFlood(seed);
  const moves: number[] = [];

  const outcome = (colour: number): number => {
    const probe = createFlood(seed);
    for (const move of moves) probe.play(move);
    return probe.play(colour) ? probe.state().filled : -1;
  };

  while (!game.state().over) {
    let pick = -1;
    let filled = -1;
    for (let colour = 0; colour < COLOURS; colour += 1) {
      const result = outcome(colour);
      if (result > filled) {
        filled = result;
        pick = colour;
      }
    }
    if (pick < 0) break;
    game.play(pick);
    moves.push(pick);
  }

  const state = game.state();
  return { moves, score: state.score, best: state.best, over: state.over };
}

/**
 * Recall: turn cards over, remember what was under them, match what it knows.
 *
 * It learns the deal by flipping, the way a player does, rather than by
 * recomputing the shuffle — so it is also the test that the engine reveals a
 * card exactly when the table is showing it.
 */
export function playRecall(seed: number): Round {
  const game = createRecall(seed);
  const moves: number[] = [];
  const known = new Map<number, number>();

  const flip = (position: number): void => {
    game.play(position);
    moves.push(position);
    const value = game.state().revealed[position];
    if (value !== null && value !== undefined) known.set(position, value);
  };

  while (!game.state().over && moves.length < CARDS * 6) {
    const { matched } = game.state();
    const open = (position: number) => !matched[position];

    const pair = [...known.keys()]
      .filter(open)
      .flatMap((first) =>
        [...known.keys()]
          .filter((second) => second > first && open(second) && known.get(second) === known.get(first))
          .map((second) => [first, second] as const),
      )[0];

    if (pair) {
      flip(pair[0]);
      flip(pair[1]);
      continue;
    }

    const unknown: number[] = [];
    for (let position = 0; position < CARDS; position += 1) {
      if (open(position) && !known.has(position)) unknown.push(position);
    }
    if (unknown.length === 0) break;

    const first = unknown[0]!;
    flip(first);
    // Its partner may already be known from an earlier attempt; if not, spend
    // the second flip learning another card.
    const partner = [...known.keys()].find(
      (position) => position !== first && open(position) && known.get(position) === known.get(first),
    );
    const second = partner ?? unknown[1];
    if (second === undefined) break;
    flip(second);
  }

  const state = game.state();
  return { moves, score: state.score, best: state.best, over: state.over };
}

/**
 * Blocks: the first square the first piece in hand will go on.
 *
 * Packing from the top left is not clever, and it is not meant to be — it fills
 * rows as a side effect, which is enough for a test to see a real round with
 * real clears in it. It asks the rules whether a placement fits rather than
 * working it out again here.
 */
export function playBlocks(seed: number, limit = 600): Round {
  const game = createBlocks(seed);
  const moves: { piece: number; cell: number }[] = [];

  while (!game.state().over && moves.length < limit) {
    const { board, tray } = game.state();

    let played = false;
    for (let piece = 0; piece < tray.length && !played; piece += 1) {
      const shape = tray[piece];
      if (shape === null || shape === undefined) continue;

      for (let cell = 0; cell < BLOCKS_SIZE * BLOCKS_SIZE; cell += 1) {
        if (!fits(board, SHAPES[shape]!, cell)) continue;
        game.play({ piece, cell });
        moves.push({ piece, cell });
        played = true;
        break;
      }
    }
    if (!played) break;
  }

  const state = game.state();
  return { moves, score: state.score, best: state.best, over: state.over };
}

/** Spot: taps the odd tile every time, which the state has to tell it. */
export function playSpot(seed: number, limit = 200): Round {
  const game = createSpot(seed);
  const moves: number[] = [];

  while (!game.state().over && moves.length < limit) {
    const { odd } = game.state();
    game.play(odd);
    moves.push(odd);
  }

  const state = game.state();
  return { moves, score: state.score, best: state.best, over: state.over };
}

/** A played round of every game in the catalog, by slug. */
export const PLAYERS: Record<GameSlug, (seed: number) => Round> = {
  blocks: (seed) => playBlocks(seed),
  spot: (seed) => playSpot(seed),
  merge: (seed) => playMerge(seed),
  trail: (seed) => playTrail(seed),
  flood: (seed) => playFlood(seed),
  recall: (seed) => playRecall(seed),
};
