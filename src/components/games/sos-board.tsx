"use client";

import { useCallback, useState } from "react";
import { type Letter, createSos } from "@/lib/games/sos";
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

  return (
    <RoundFrame
      game={GAMES.sos}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.best ?? 0}
      hint={
        state
          ? `Board ${state.board_no} · ${state.size}×${state.size} — you ${state.you}, it ${state.bot}`
          : null
      }
      ended={state?.cleared ? "You cleared the ladder." : "It took the board."}
    >
      <div className="rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]">
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
                      : "bg-surf-2/40 enabled:hover:bg-surf-2"
                }`}
              >
                {written}
              </button>
            );
          })}
        </div>
      </div>
    </RoundFrame>
  );
}
