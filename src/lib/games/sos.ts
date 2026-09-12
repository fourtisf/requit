import { below, rng } from "@/lib/games/rng";
import { type Engine, type GameRules } from "@/lib/games/engine";

/**
 * SOS — the squared-paper game, against an opponent that has to be beaten.
 *
 * Write S or O in any empty square. Complete S-O-S in a line and it is yours,
 * and you go again. When the grid fills, the higher count wins the board.
 *
 * It is on the shelf because half of Indonesia learned it at a school desk, and
 * a game somebody already knows is a game that needs no instructions — the
 * thing every other game here had to be redesigned to achieve.
 *
 * The opponent is the interesting part. It is a function of the seed and the
 * board, not a player on the other end: it takes a win when one is there, it
 * refuses to hand one over when it can see it coming, and it breaks ties out of
 * the same seeded stream everything else here uses. So a whole match — both
 * sides of it — replays exactly on the server from the moves one player made.
 * The opponent never has to be trusted, because the opponent is a rule.
 */

/**
 * The ladder: win a board and the next one is larger, ending at the last size.
 *
 * It ends rather than repeating the biggest board forever. A run that cannot
 * finish is a run with no shape to it — the test player went 389 moves and was
 * still going, which is not the two-minute round this shelf promises. Four
 * boards is a thing you can clear.
 */
export const FIRST_SIZE = 5;
export const LAST_SIZE = 8;
export const BOARDS = LAST_SIZE - FIRST_SIZE + 1;

export const SOS_POINTS = 100;
export const BOARD_POINTS = 200;

/**
 * A ceiling on a submitted run. The whole ladder is 25 + 36 + 49 + 64 squares,
 * and a player can only have placed some of them, so this is slack rather than
 * a limit anybody meets.
 */
export const MAX_MOVES = 200;

export type Letter = "S" | "O";
/** "" is an empty square. */
export type Square = "" | Letter;

export type SosMove = { cell: number; letter: Letter };

export type SosState = {
  size: number;
  board: readonly Square[];
  /** SOS lines each side has made on this board. */
  you: number;
  bot: number;
  /** Which board of the run this is, 1-based. */
  board_no: number;
  score: number;
  over: boolean;
  /** Boards won — the run's second number. */
  best: number;
  /** True when the last board was won: the ladder is finished, not lost. */
  cleared: boolean;
  /** The squares of the last SOS made, for the board to point at. */
  last: readonly number[];
  /** Who made it, so the board can colour it. */
  lastBy: "you" | "bot" | null;
};

export function sizeFor(board: number): number {
  return Math.min(FIRST_SIZE + board - 1, LAST_SIZE);
}

const DIRECTIONS = [
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
  { dx: 1, dy: -1 },
] as const;

/**
 * The S-O-S lines the square at `cell` completes.
 *
 * Counted as windows rather than as letters: each run of three is checked once
 * per direction from each of the three positions the placed square could hold
 * in it, so a placement that finishes two lines at once counts two and never
 * counts the same line twice.
 */
export function linesFrom(board: readonly Square[], size: number, cell: number): number[][] {
  const x = cell % size;
  const y = Math.floor(cell / size);
  const found: number[][] = [];

  for (const { dx, dy } of DIRECTIONS) {
    for (let offset = -2; offset <= 0; offset += 1) {
      const squares: number[] = [];
      for (let step = 0; step < 3; step += 1) {
        const column = x + dx * (offset + step);
        const row = y + dy * (offset + step);
        if (column < 0 || row < 0 || column >= size || row >= size) break;
        squares.push(row * size + column);
      }
      if (squares.length < 3) continue;
      if (!squares.includes(cell)) continue;

      const [a, b, c] = squares as [number, number, number];
      if (board[a] === "S" && board[b] === "O" && board[c] === "S") found.push(squares);
    }
  }
  return found;
}

/**
 * Every placement that would complete at least one line, best first.
 *
 * Exported because "is there a line going spare right now" is the question both
 * the opponent and any other player of this game has to ask, and two answers to
 * it would eventually disagree.
 */
export function scoringMoves(board: readonly Square[], size: number): { move: SosMove; lines: number }[] {
  const moves: { move: SosMove; lines: number }[] = [];

  for (let cell = 0; cell < size * size; cell += 1) {
    if (board[cell] !== "") continue;
    for (const letter of ["S", "O"] as Letter[]) {
      const after = [...board];
      after[cell] = letter;
      const lines = linesFrom(after, size, cell).length;
      if (lines > 0) moves.push({ move: { cell, letter }, lines });
    }
  }
  return moves.sort((a, b) => b.lines - a.lines);
}

function empties(board: readonly Square[]): number[] {
  const open: number[] = [];
  board.forEach((square, cell) => {
    if (square === "") open.push(cell);
  });
  return open;
}

/**
 * How often the opponent bothers to look one move ahead, by board.
 *
 * This is the difficulty curve, and it exists because the game without one is
 * unplayable. SOS ends in zugzwang — whoever runs out of harmless squares first
 * has to open a line, and the extra turn then lets the other side chain several
 * in a row. An opponent that always looks ahead wins the endgame every time: a
 * competent test player lost 0–10, 0–6, 0–5 against it, which is not a game,
 * it is a wall.
 *
 * So it is careless early and careful later. It always takes a line it can see
 * — a bot that walks past a free point looks broken, and being visibly stupid
 * is worse than being easy — but on the early boards it often fails to notice
 * what it is leaving behind, which is exactly how a human beginner plays.
 */
export function carefulness(board: number): number {
  return Math.min(0.9, 0.25 + 0.2 * (board - 1));
}

/**
 * The opponent's move.
 *
 * Three rules, in order: take a line if one is there; otherwise, if it is
 * paying attention this turn, play something that does not leave one on the
 * table; otherwise play anywhere, seeded.
 */
function botMove(
  board: readonly Square[],
  size: number,
  next: () => number,
  care: number,
): SosMove | null {
  const open = empties(board);
  if (open.length === 0) return null;

  const wins = scoringMoves(board, size);
  if (wins.length > 0) return wins[0]!.move;

  // Drawn before the search, not after, so the stream advances the same way
  // whether or not a safe move exists — a replay has to see the same rolls.
  const looking = next() < care;

  const safe: SosMove[] = [];
  for (const cell of open) {
    for (const letter of ["S", "O"] as Letter[]) {
      const after = [...board];
      after[cell] = letter;
      if (scoringMoves(after, size).length === 0) safe.push({ cell, letter });
    }
  }

  const careless = open.map((cell) => ({ cell, letter: "O" as Letter }));
  const pool = looking && safe.length > 0 ? safe : careless;
  return pool[below(pool.length, next)]!;
}

export function createSos(seed: number): Engine<SosMove, SosState> {
  const next = rng(seed);

  let board_no = 1;
  let size = sizeFor(board_no);
  let board: Square[] = new Array<Square>(size * size).fill("");
  let you = 0;
  let bot = 0;
  let score = 0;
  let best = 0;
  let over = false;
  let cleared = false;
  let last: number[] = [];
  let lastBy: "you" | "bot" | null = null;

  /** Lays out the next board of the run. */
  function deal(): void {
    board_no += 1;
    size = sizeFor(board_no);
    board = new Array<Square>(size * size).fill("");
    you = 0;
    bot = 0;
    last = [];
    lastBy = null;
  }

  /** Called when the grid fills: the higher count takes the board. */
  function settle(): void {
    if (you > bot) {
      score += BOARD_POINTS;
      best += 1;
      if (board_no >= BOARDS) {
        // The top of the ladder. Winning it ends the run the good way.
        cleared = true;
        over = true;
        return;
      }
      deal();
      return;
    }
    // A draw is not a win. The run ends on anything that is not ahead.
    over = true;
  }

  function place(move: SosMove, who: "you" | "bot"): number {
    board[move.cell] = move.letter;
    const lines = linesFrom(board, size, move.cell);
    if (lines.length > 0) {
      last = lines.flat();
      lastBy = who;
      if (who === "you") {
        you += lines.length;
        score += SOS_POINTS * lines.length;
      } else {
        bot += lines.length;
      }
    }
    return lines.length;
  }

  return {
    state: () => ({
      size,
      board: [...board],
      you,
      bot,
      board_no,
      score,
      over,
      best,
      cleared,
      last: [...last],
      lastBy,
    }),
    play: (move) => {
      if (over) return false;
      if (move === null || typeof move !== "object") return false;
      if (move.letter !== "S" && move.letter !== "O") return false;
      if (!Number.isInteger(move.cell) || move.cell < 0 || move.cell >= size * size) return false;
      if (board[move.cell] !== "") return false;

      const scored = place(move, "you");
      if (empties(board).length === 0) {
        settle();
        return true;
      }
      // A line earns another turn. The board stays yours.
      if (scored > 0) return true;

      // The opponent answers, and keeps answering while it is scoring.
      for (let guard = 0; guard <= size * size; guard += 1) {
        const reply = botMove(board, size, next, carefulness(board_no));
        if (reply === null) break;

        const botScored = place(reply, "bot");
        if (empties(board).length === 0) {
          settle();
          return true;
        }
        if (botScored === 0) break;
      }
      return true;
    },
  };
}

export const SOS_RULES: GameRules<SosMove> = {
  maxMoves: MAX_MOVES,
  create: createSos,
  parse: (value) => {
    if (value === null || typeof value !== "object") return null;
    const move = value as { cell?: unknown; letter?: unknown };
    if (!Number.isInteger(move.cell)) return null;
    if (move.letter !== "S" && move.letter !== "O") return null;
    return { cell: move.cell as number, letter: move.letter };
  },
};
