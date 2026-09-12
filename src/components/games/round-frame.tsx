"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { GameEntry } from "@/lib/games/catalog";
import type { Round } from "@/components/games/use-round";

/**
 * Everything around a board: the score, the way in, and what a finished round
 * is told.
 *
 * The boards themselves are four different shapes, but a player meets the same
 * screen each time — the numbers in the same corners, the same sentence about
 * what was recorded and what was not. Keeping that here is what stops the
 * fourth game from quietly having a slightly different story about scoring.
 *
 * Two rules this layout exists to obey, both learned the hard way from a
 * laptop at 150% zoom:
 *
 * 1. The way to start is ON the board. A start button under the board is a
 *    start button below the fold, and what is left on screen is a full-size
 *    empty grid that does not answer a click. The board reads as broken, and
 *    the player is right — there was nothing to press.
 * 2. The board fits the window. Capping the column against viewport height as
 *    well as width means the grid, its score and its button are all on screen
 *    at once, on a short window as much as on a phone.
 */
export function RoundFrame<TMove, TState>({
  game,
  round,
  signedIn,
  score,
  secondary,
  hint,
  ended,
  children,
}: {
  game: GameEntry;
  round: Round<TMove, TState>;
  signedIn: boolean;
  score: number;
  /** The game's own second number — see GameEntry.bestLabel. */
  secondary: number;
  /** One line under the board while a round is running. */
  hint?: ReactNode;
  /** How this game says the round ended. Each has its own way of stopping. */
  ended?: ReactNode;
  children: ReactNode;
}) {
  const { status, error, saved, best } = round;
  const waiting = status === "loading" || status === "saving";

  /**
   * Bring the whole board into view when a round starts.
   *
   * On a short window the grid's last row can sit under the fold, and the one
   * moment that is unforgivable is the one just after the player pressed play.
   * `nearest` scrolls the minimum needed, so a window where it already fits
   * does not move at all.
   */
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === "playing") board.current?.scrollIntoView({ block: "nearest" });
  }, [status]);

  return (
    <div className="w-full max-w-[min(460px,58vh)]">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="mn text-[11.5px] uppercase tracking-[0.08em] text-fg-4">Score</p>
          <p className="mn text-[30px] font-semibold tracking-[-0.03em]">{score}</p>
        </div>
        <div>
          <p className="mn text-[11.5px] uppercase tracking-[0.08em] text-fg-4">{game.bestLabel}</p>
          <p className="mn text-[17px] text-fg-2">{secondary}</p>
        </div>
        <div className="text-right">
          <p className="mn text-[11.5px] uppercase tracking-[0.08em] text-fg-4">Your best</p>
          <p className="mn text-[17px] text-fg-2">{best}</p>
        </div>
      </div>

      {/* The control line lives above the board, not under it.
          Under the board is under the fold on a short window, and the one
          moment it has to be readable is the moment a round starts. The height
          is reserved so that starting a round does not shift the grid. */}
      <p className="mt-4 min-h-[19px] text-[12.5px] text-fg-2">
        {status === "playing" ? hint : null}
      </p>

      <div ref={board} className="relative mt-1.5">
        {children}

        {status === "playing" ? null : (
          <div className="absolute inset-0 flex items-center justify-center rounded-card bg-[rgba(8,9,10,.74)] px-4 text-center backdrop-blur-[2px]">
            {waiting ? (
              <p className="text-[13px] text-fg-3">
                {status === "loading" ? "Starting…" : "Saving the round…"}
              </p>
            ) : (
              // The whole panel is the button. Anywhere on the board starts the
              // next round, which is what a player tries first anyway.
              <button
                type="button"
                onClick={round.begin}
                className="group flex w-full flex-col items-center gap-3 py-6"
              >
                {status === "over" ? (
                  <span className="flex flex-col gap-1.5">
                    <span className="text-[15px] font-semibold tracking-[-0.02em]">
                      {ended ?? "Round over."}
                    </span>
                    {saved !== null ? (
                      <span className="text-[12.5px] text-fg-2">
                        Scored <span className="mn text-ac-2">{saved}</span>, checked on the server
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-fg-2">
                        Scored <span className="mn text-ac-2">{score}</span>
                        {signedIn ? "" : ", kept nowhere"}
                      </span>
                    )}
                  </span>
                ) : null}

                <span className="inline-flex items-center rounded-full bg-white px-[26px] py-[13px] text-[15px] font-semibold tracking-[-0.015em] text-bg shadow-[0_0_0_1px_rgba(255,255,255,.9),0_8px_26px_-12px_rgba(255,255,255,.32)] transition-transform duration-200 group-hover:-translate-y-px">
                  {status === "over" ? "Play again" : signedIn ? "Start a round" : "Play now"}
                </span>

                <span className="text-[12px] text-fg-3">{game.input}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {status === "over" && !signedIn ? (
        <p className="mt-4 max-w-[46ch] text-[13px] leading-[1.6] text-fg-2">
          Nothing was recorded.{" "}
          <a href="/signin" className="text-ac-2 underline underline-offset-4">
            Sign in
          </a>{" "}
          and your rounds start being kept against your account.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-[12.5px] text-amber">{error}</p> : null}
    </div>
  );
}
