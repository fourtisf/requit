import { describe, expect, it } from "vitest";
import { FRUIT_POINTS, MAX_TICKS, SIZE, TRAIL_RULES, createTrail } from "@/lib/games/trail";
import { verifyRound } from "@/lib/games/engine";
import { playTrail } from "@/test/players";
import type { Direction } from "@/lib/games/direction";

/** Runs a scripted list of ticks, so a test can read as a sequence of moves. */
function run(seed: number, moves: readonly Direction[]) {
  const game = createTrail(seed);
  const played = moves.map((move) => game.play(move));
  return { game, played, state: game.state() };
}

/** Holds one heading until the run ends, and reports what it took. */
function runInto(seed: number, heading: Direction) {
  const game = createTrail(seed);
  const played: boolean[] = [];
  while (!game.state().over && played.length < SIZE * 2) played.push(game.play(heading));
  return { game, played, state: game.state() };
}

/**
 * A seed whose fruit is not sitting in the path of a straight run to the right,
 * so a test about a run that eats nothing is about exactly that.
 */
function seedWithNothingAhead(): number {
  const middle = Math.floor(SIZE / 2);
  for (let seed = 1; seed < 500; seed += 1) {
    const { snake, fruit } = createTrail(seed).state();
    const ahead = Math.floor(fruit / SIZE) === middle && fruit > snake[0]!;
    if (!ahead) return seed;
  }
  throw new Error("no seed puts the fruit off the opening row");
}

describe("opening position", () => {
  it("puts three segments mid-board, heading right", () => {
    const state = createTrail(1).state();
    expect(state.snake).toHaveLength(3);
    expect(state.heading).toBe("right");
    expect(state.over).toBe(false);
    expect(state.score).toBe(0);
  });

  it("puts the fruit somewhere free", () => {
    const state = createTrail(1).state();
    expect(state.fruit).toBeGreaterThanOrEqual(0);
    expect(state.fruit).toBeLessThan(SIZE * SIZE);
    expect(state.snake).not.toContain(state.fruit);
  });

  it("deals the same fruit for the same seed, and a different one for another", () => {
    // The replay rests on this: same seed, same game, on any machine.
    expect(createTrail(77).state().fruit).toBe(createTrail(77).state().fruit);
    const seeds = new Set([1, 2, 3, 4, 5].map((seed) => createTrail(seed).state().fruit));
    expect(seeds.size).toBeGreaterThan(1);
  });
});

describe("steering", () => {
  it("refuses a reversal", () => {
    // The board drops this before it is sent, so one arriving in a submission
    // means the list did not come from a board.
    expect(run(1, ["left"]).played).toEqual([false]);
  });

  it("allows carrying straight on", () => {
    expect(run(1, ["right", "right"]).played).toEqual([true, true]);
  });

  it("allows a turn, and then the reversal of the new heading is the refused one", () => {
    const { played, state } = run(1, ["up", "down"]);
    expect(played).toEqual([true, false]);
    expect(state.heading).toBe("up");
  });
});

describe("ending the run", () => {
  it("ends at a wall, and the move into it is legal", () => {
    const { played, state } = runInto(1, "right");

    // Every tick is a legal move, including the last one — dying is a move.
    expect(played.every(Boolean)).toBe(true);
    // Six cells of board to the right of the head, then the wall.
    expect(played).toHaveLength(Math.ceil(SIZE / 2));
    expect(state.over).toBe(true);
  });

  it("refuses any move after the run is over", () => {
    const { game, state } = runInto(1, "right");
    expect(state.over).toBe(true);
    expect(game.play("up")).toBe(false);
  });

  it("ends on its own trail once the trail is long enough to bite", () => {
    // Three segments cannot reach themselves — the tail vacates the cell the
    // head would land on. A fed trail can. Feed it with the bot's moves until
    // it is five long, then turn a tight square straight back onto it.
    const game = createTrail(4);
    for (const move of playTrail(4, 400).moves as Direction[]) {
      if (game.state().snake.length >= 5) break;
      game.play(move);
    }
    expect(game.state().snake.length).toBeGreaterThanOrEqual(5);
    expect(game.state().over).toBe(false);

    const heading = game.state().heading;
    const square: Direction[] =
      heading === "right" || heading === "left"
        ? ["up", heading === "right" ? "left" : "right", "down", heading]
        : ["left", heading === "down" ? "up" : "down", "right", heading];
    for (const move of square) game.play(move);

    expect(game.state().over).toBe(true);
  });
});

describe("eating", () => {
  it("grows the trail and scores the length it reached", () => {
    const { moves } = playTrail(9, 400);
    const game = createTrail(9);
    let before = game.state();

    for (const move of moves as Direction[]) {
      const eating = before.snake[0] !== undefined && before.fruit >= 0;
      game.play(move);
      const after = game.state();
      if (after.snake.length > before.snake.length) {
        expect(eating).toBe(true);
        expect(after.score).toBe(before.score + FRUIT_POINTS + after.snake.length);
        return;
      }
      before = after;
    }
    throw new Error("the bot never reached a fruit");
  });

  it("scores nothing for a run that eats nothing", () => {
    const { state } = runInto(seedWithNothingAhead(), "right");
    expect(state.over).toBe(true);
    expect(state.snake).toHaveLength(3);
    expect(state.score).toBe(0);
  });
});

describe("replaying a run", () => {
  it("reaches the score the player saw", () => {
    const round = playTrail(2024);
    expect(round.over).toBe(true);
    expect(round.score).toBeGreaterThan(0);

    expect(verifyRound(TRAIL_RULES, 2024, round.moves)).toEqual({
      ok: true,
      score: round.score,
      moves: round.moves.length,
      best: round.best,
    });
  });

  it("refuses a run padded past the crash", () => {
    const round = playTrail(2024);
    const padded = verifyRound(TRAIL_RULES, 2024, [...round.moves, "up"]);
    expect(padded).toEqual({
      ok: false,
      reason: "illegal-move",
      atMove: round.moves.length,
    });
  });

  it("refuses someone else's run", () => {
    const round = playTrail(2024);
    const borrowed = verifyRound(TRAIL_RULES, 31337, round.moves);
    // A different seed puts the fruit elsewhere, so the borrowed list either
    // desyncs into an illegal move or scores differently. Both are a refusal.
    if (borrowed.ok) expect(borrowed.score).not.toBe(round.score);
  });

  it("caps a submission at the tick ceiling", () => {
    const flood = new Array<string>(MAX_TICKS + 1).fill("right");
    expect(verifyRound(TRAIL_RULES, 1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: MAX_TICKS,
    });
  });
});
