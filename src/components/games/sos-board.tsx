"use client";

import { useCallback, useState } from "react";
import { type Letter, type Square, createSos, linesFrom, scoringMoves } from "@/lib/games/sos";
import { GAMES } from "@/lib/games/catalog";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";

/**
 * SOS: the grid, the two letters, and the opponent's answer.
 *
 * The opponent moves inside the same call as you, so the board on screen is
 * always waiting for the player — there is no "thinking" state to design and
 * nothing to wait for. The line that was just made is marked, and by whom,
 * because a match where points appear without being pointed at is a match
 * nobody can learn from.
 */
export function SosBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const round = useRound({
    game: "sos",
    signedIn,
    personalBest,
    create: useCallback((seed: number) => createSos(seed), []),
  });
  const { state, status, send } = round;

  const [letter, setLetter] = useState<Letter>("S");
  const playing = status === "playing";
  const size = state?.size ?? 5;
  const board = state?.board ?? new Array<string>(size * size).fill("");
  const line = new Set(state?.last ?? []);
  const mine = state?.lastBy === "you";

  /**
   * Squares where the letter in your hand would finish a line.
   *
   * The hard part of SOS on a screen is not strategy, it is scanning: a player
   * has to sweep the whole grid for S_S, SO_ and _OS every turn, and the ones
   * they miss are the ones the opponent takes. On paper you see the board for
   * as long as you like; here the board can just say so.
   *
   * It gives nothing away. Taking every line you can see is exactly what the
   * opponent does, and it still loses boards — the game is in what you leave
   * behind, and that part is untouched.
   */
  const scoring = new Set<number>();
  /**
   * And, on the first board only, squares that would hand the opponent one.
   *
   * This is the half that decides the game: writing S beside an S, or O between
   * two S's, loses the next turn. Showing it teaches the pattern — and showing
   * it forever plays the game for you. Measured both ways: a player who took
   * every green square and avoided every amber one cleared the whole ladder
   * five times out of five, while the same player without the warning finished
   * on 1, 2, 3, 4 and 4 boards. The second one is a game.
   *
   * So board one is where it is explained, and from board two you are looking
   * for it yourself.
   */
  const risky = new Set<number>();

  if (playing && state) {
    for (let cell = 0; cell < size * size; cell += 1) {
      if (board[cell] !== "") continue;
      const after = [...board] as Square[];
      after[cell] = letter;

      if (linesFrom(after, size, cell).length > 0) scoring.add(cell);
      else if (state.board_no === 1 && scoringMoves(after, size).length > 0) risky.add(cell);
    }
  }

  return (
    <RoundFrame
      game={GAMES.sos}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.best ?? 0}
      hint={
        state
          ? `Board ${state.board_no} · ${state.size}×${state.size} — you ${state.you}, it ${state.bot}${
              state.board_no === 1 ? " · amber gives it a line" : ""
            }`
          : null
      }
      ended={state?.cleared ? "You cleared the ladder." : "It took the board."}
    >
      {/*
        Sized by the board rather than by the column. Stretching five squares
        across 460px gave 90px cells holding one letter each, which reads as a
        different game from the eight-square board it grows into — and looks
        like a mistake next to every other board on the shelf. Capped per
        square, the grid grows as the ladder does, which is the point of it.
      */}
      <div
        className="rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]"
        style={{ maxWidth: `${size * 58 + 22}px` }}
      >
        {/* Which letter you are writing. Two buttons rather than a toggle: at a
            glance you can see which one is armed, which a switch does not give
            you when the thing it controls is a letter. */}
        <div className="mb-2 flex gap-2">
          {(["S", "O"] as Letter[]).map((option) => (
            <button
              key={option}
              type="button"
              disabled={!playing}
              onClick={() => setLetter(option)}
              aria-pressed={letter === option}
              aria-label={`Write ${option}`}
              className={`mn flex h-11 flex-1 items-center justify-center rounded-soft text-[17px] transition-colors ${
                letter === option
                  ? "bg-ac-dim text-ac-2 shadow-[inset_0_0_0_1px_rgba(107,203,165,.4)]"
                  : "bg-surf-2/50 text-fg-3 enabled:hover:bg-surf-2 enabled:hover:text-fg"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div
          className="grid select-none gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: size * size }, (_, cell) => {
            const written = board[cell] ?? "";
            const inLine = line.has(cell);
            const wins = scoring.has(cell);
            const gives = risky.has(cell);

            return (
              <button
                key={cell}
                type="button"
                disabled={!playing || written !== ""}
                onClick={() => send({ cell, letter })}
                aria-label={written === "" ? `Square ${cell + 1}, empty` : `Square ${cell + 1}, ${written}`}
                className={`mn flex aspect-square items-center justify-center rounded-[5px] font-semibold transition-colors duration-150 ${
                  size > 6 ? "text-[clamp(12px,3.4vw,17px)]" : "text-[clamp(14px,4vw,21px)]"
                } ${
                  inLine
                    ? mine
                      ? "bg-[rgba(107,203,165,.55)] text-bg"
                      : "bg-[rgba(232,198,139,.45)] text-bg"
                    : written !== ""
                      ? "bg-surf-3 text-fg-2"
                      : wins
                        ? "bg-ac-dim shadow-[inset_0_0_0_1px_rgba(107,203,165,.45)] enabled:hover:bg-[rgba(107,203,165,.22)]"
                        : "bg-surf-2/40 enabled:hover:bg-surf-2"
                }`}
              >
                {/* A dot rather than an amber outline: an amber *fill* already
                    means "the line it just took", and two amber meanings on one
                    board is one too many. */}
                {written === "" && gives ? (
                  <span className="size-[5px] rounded-full bg-[rgba(232,198,139,.55)]" />
                ) : (
                  written
                )}
              </button>
            );
          })}
        </div>
      </div>
    </RoundFrame>
  );
}
