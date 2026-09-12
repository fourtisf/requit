import { describe, expect, it } from "vitest";
import {
  BOARDS,
  BOARD_POINTS,
  FIRST_SIZE,
  LAST_SIZE,
  MAX_MOVES,
  SOS_POINTS,
  SOS_RULES,
  type Square,
  type SosMove,
  carefulness,
  createSos,
  linesFrom,
  scoringMoves,
  sizeFor,
} from "@/lib/games/sos";
import { verifyRound } from "@/lib/games/engine";
import { playSos } from "@/test/players";

/** Reads a board from rows of letters, so a test looks like squared paper. */
function paper(...rows: string[]): { board: Square[]; size: number } {
  const size = rows[0]!.length;
  expect(rows).toHaveLength(size);
  const board = rows.flatMap((row) => [...row].map((mark) => (mark === "." ? "" : mark) as Square));
  return { board, size };
}

describe("finding a line", () => {
  it("reads across, down and both diagonals", () => {
    const across = paper("SOS..", ".....", ".....", ".....", ".....");
    expect(linesFrom(across.board, across.size, 2)).toHaveLength(1);

    const down = paper("S....", "O....", "S....", ".....", ".....");
    expect(linesFrom(down.board, down.size, 10)).toHaveLength(1);

    const slash = paper("S....", ".O...", "..S..", ".....", ".....");
    expect(linesFrom(slash.board, slash.size, 12)).toHaveLength(1);

    const backslash = paper("..S..", ".O...", "S....", ".....", ".....");
    expect(linesFrom(backslash.board, backslash.size, 10)).toHaveLength(1);
  });

  it("counts a square that finishes two lines at once as two", () => {
    // The S in the middle closes the row and the column. Both are real lines
    // and both are paid for; counting the same one twice would not be.
    const both = paper("..S..", "..O..", "SOS..", ".....", ".....");
    expect(linesFrom(both.board, both.size, 12)).toHaveLength(2);
  });

  it("reads nothing in a line that is not S-O-S", () => {
    const wrong = paper("SSS..", ".....", ".....", ".....", ".....");
    expect(linesFrom(wrong.board, wrong.size, 1)).toHaveLength(0);

    const other = paper("OSO..", ".....", ".....", ".....", ".....");
    expect(linesFrom(other.board, other.size, 1)).toHaveLength(0);
  });

  it("does not run off one row onto the next", () => {
    // Row-major storage makes "S O S" across a wrap look contiguous in the
    // array. On paper it is three squares in two different rows.
    const wrapped = paper("...SO", "S....", ".....", ".....", ".....");
    expect(linesFrom(wrapped.board, wrapped.size, 5)).toHaveLength(0);
  });

  it("offers every placement that would finish one", () => {
    const nearly = paper("SO...", ".....", ".....", ".....", ".....");
    const moves = scoringMoves(nearly.board, nearly.size);
    expect(moves.map((entry) => entry.move)).toContainEqual({ cell: 2, letter: "S" });
  });
});

describe("the ladder", () => {
  it("starts small and ends, rather than repeating the biggest board", () => {
    expect(sizeFor(1)).toBe(FIRST_SIZE);
    expect(sizeFor(BOARDS)).toBe(LAST_SIZE);
    expect(BOARDS).toBe(LAST_SIZE - FIRST_SIZE + 1);
  });

  it("lets the opponent look further ahead the higher you get", () => {
    // The difficulty curve exists because the game without one is a wall: an
    // opponent that always looks ahead wins every endgame.
    expect(carefulness(1)).toBeLessThan(carefulness(2));
    expect(carefulness(2)).toBeLessThan(carefulness(BOARDS));
    expect(carefulness(BOARDS)).toBeLessThanOrEqual(0.9);
  });
});

describe("a placement", () => {
  it("is refused on a square that is taken", () => {
    const game = createSos(4);
    expect(game.play({ cell: 0, letter: "S" })).toBe(true);
    expect(game.play({ cell: 0, letter: "O" })).toBe(false);
  });

  it("is refused for anything that is not S or O", () => {
    const game = createSos(4);
    for (const letter of ["X", "s", "", 1, null]) {
      expect(game.play({ cell: 5, letter } as unknown as SosMove)).toBe(false);
    }
  });

  it("is refused off the board", () => {
    const game = createSos(4);
    const { size } = game.state();
    for (const cell of [-1, size * size, 2.5, Number.NaN]) {
      expect(game.play({ cell, letter: "S" })).toBe(false);
    }
  });
});

describe("playing a run", () => {
  /** Replays a bot run move by move, so each turn can be inspected. */
  function walk(seed: number) {
    const round = playSos(seed);
    const game = createSos(seed);
    const steps = (round.moves as SosMove[]).map((move) => {
      const before = game.state();
      game.play(move);
      return { move, before, after: game.state() };
    });
    return { round, steps };
  }

  it("hands the board back to you when you complete a line", () => {
    const { steps } = walk(2024);
    const scored = steps.filter((step) => step.after.you > step.before.you);
    expect(scored.length).toBeGreaterThan(0);

    for (const step of scored) {
      if (step.after.board_no !== step.before.board_no) continue; // board changed under it
      const filledBefore = step.before.board.filter((square) => square !== "").length;
      const filledAfter = step.after.board.filter((square) => square !== "").length;
      // One square: yours. The opponent did not get a turn.
      expect(filledAfter - filledBefore).toBe(1);
      expect(step.after.bot).toBe(step.before.bot);
    }
  });

  it("pays for every line as it is made", () => {
    const { steps } = walk(7);
    for (const step of steps) {
      // Skip the turn that takes a board: that one carries the board's own
      // payment too. Winning the last board does not change board_no — the run
      // ends there rather than dealing a fifth — so ask whether a board was
      // won, not whether the number moved.
      if (step.after.best > step.before.best) continue;

      const lines = step.after.you - step.before.you;
      expect(step.after.score - step.before.score).toBe(lines * SOS_POINTS);
    }
  });

  it("never lets the opponent walk past a line it could take", () => {
    // The first of its three rules. A bot that leaves a free point on the board
    // reads as broken, which is worse than reading as easy.
    const { steps } = walk(3);
    for (const step of steps) {
      if (step.after.you > step.before.you) continue; // you kept the turn
      if (step.after.board_no !== step.before.board_no) continue;

      const after = [...step.before.board];
      after[step.move.cell] = step.move.letter;
      if (scoringMoves(after, step.before.size).length === 0) continue;

      expect(step.after.bot).toBeGreaterThan(step.before.bot);
    }
  });

  it("moves up a size when you take a board, and pays for it", () => {
    const { steps } = walk(2024);
    const promotions = steps.filter((step) => step.after.board_no > step.before.board_no);
    expect(promotions.length).toBeGreaterThan(0);

    for (const step of promotions) {
      expect(step.after.size).toBe(sizeFor(step.after.board_no));
      expect(step.after.board.some((square) => square !== "")).toBe(false);
      expect(step.after.you).toBe(0);
      expect(step.after.bot).toBe(0);
      expect(step.after.best).toBe(step.before.best + 1);
    }
  });

  it("ends the run at the top of the ladder, as cleared rather than lost", () => {
    const round = playSos(2024);
    const game = createSos(2024);
    for (const move of round.moves as SosMove[]) game.play(move);

    const state = game.state();
    expect(state.over).toBe(true);
    expect(state.cleared).toBe(true);
    expect(state.best).toBe(BOARDS);
    expect(state.score).toBeGreaterThanOrEqual(BOARDS * BOARD_POINTS);
    expect(game.play({ cell: 0, letter: "S" })).toBe(false);
  });
});

describe("replaying a run", () => {
  it("reaches the score the player saw, opponent and all", () => {
    // The opponent is a function of the seed, so the server replays both sides
    // of the match from one player's moves.
    const round = playSos(2024);
    expect(verifyRound(SOS_RULES, 2024, round.moves)).toEqual({
      ok: true,
      score: round.score,
      moves: round.moves.length,
      best: round.best,
    });
  });

  it("refuses a run padded past the end", () => {
    const round = playSos(2024);
    const padded = verifyRound(SOS_RULES, 2024, [...round.moves, { cell: 0, letter: "S" }]);
    expect(padded).toEqual({ ok: false, reason: "illegal-move", atMove: round.moves.length });
  });

  it("refuses a move that is not a placement", () => {
    for (const move of [0, "S", null, { cell: 0 }, { letter: "S" }, { cell: 0, letter: "X" }]) {
      const result = verifyRound(SOS_RULES, 1, [move]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("bad-moves");
    }
  });

  it("refuses someone else's run", () => {
    // A different seed is a different opponent, so the same squares meet
    // different replies and stop being legal.
    const round = playSos(2024);
    const borrowed = verifyRound(SOS_RULES, 31337, round.moves);
    if (borrowed.ok) expect(borrowed.score).not.toBe(round.score);
  });

  it("cannot be submitted with more placements than the ladder holds", () => {
    const flood = new Array(MAX_MOVES + 1).fill({ cell: 0, letter: "S" });
    expect(verifyRound(SOS_RULES, 1, flood)).toEqual({
      ok: false,
      reason: "too-many-moves",
      atMove: MAX_MOVES,
    });
  });
});
