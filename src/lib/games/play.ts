import { type Board, type Direction, best, emptyBoard, isOver, move, rng, spawn } from "@/lib/games/merge";

/**
 * A game in progress, and the replay that checks one after the fact.
 *
 * The client runs `createGame` to play. The server runs the *same* function
 * over the move list the client submits, and takes its own result as the score.
 * The number the browser reports is never read — not compared, not trusted,
 * not stored. There is no way to make "the client said 90,000" safe, and the
 * moment a score becomes money, someone will say it.
 *
 * Replay works because nothing here is ambient: one seeded generator drives the
 * two opening tiles and every spawn after, in that order, so the same seed and
 * the same moves reproduce the same board on any machine.
 */

/** A ceiling on a submitted game, so a replay cannot be used to burn CPU. */
export const MAX_MOVES = 20_000;

export type GameState = {
  board: Board;
  score: number;
  moves: number;
  over: boolean;
  best: number;
};

export type Game = {
  state: () => GameState;
  /** False when the board did not shift: not a move, and nothing spawns. */
  play: (direction: Direction) => boolean;
};

export function createGame(seed: number): Game {
  const next = rng(seed);
  let board = spawn(spawn(emptyBoard(), next), next);
  let score = 0;
  let moves = 0;

  return {
    state: () => ({ board, score, moves, over: isOver(board), best: best(board) }),
    play: (direction) => {
      if (isOver(board)) return false;

      const result = move(board, direction);
      if (!result.moved) return false;

      board = spawn(result.board, next);
      score += result.gained;
      moves += 1;
      return true;
    },
  };
}

export type ReplayFailure = "too-many-moves" | "illegal-move";

export type Replay =
  | { ok: true; score: number; moves: number; best: number }
  | { ok: false; reason: ReplayFailure; atMove: number };

/**
 * Recomputes a game from its seed and its moves.
 *
 * A move that does not shift the board is rejected rather than skipped. A real
 * client cannot produce one — it has the board in front of it — so its presence
 * means the move list was assembled by something else, and the honest response
 * is to refuse the whole submission rather than score a game nobody played.
 */
export function replay(seed: number, moves: readonly Direction[]): Replay {
  if (moves.length > MAX_MOVES) {
    return { ok: false, reason: "too-many-moves", atMove: MAX_MOVES };
  }

  const game = createGame(seed);
  for (let index = 0; index < moves.length; index += 1) {
    if (!game.play(moves[index]!)) {
      return { ok: false, reason: "illegal-move", atMove: index };
    }
  }

  const final = game.state();
  return { ok: true, score: final.score, moves: final.moves, best: final.best };
}
