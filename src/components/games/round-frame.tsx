"use client";

import type { ReactNode } from "react";
import type { GameEntry } from "@/lib/games/catalog";
import type { Round } from "@/components/games/use-round";
import { Button } from "@/components/ui/button";

/**
 * Everything around a board: the score, the start button, and what a finished
 * round is told.
 *
 * The boards themselves are four different shapes, but a player meets the same
 * screen each time — the numbers in the same corners, the same sentence about
 * what was recorded and what was not. Keeping that here is what stops the
 * fourth game from quietly having a slightly different story about scoring.
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

  return (
    <div className="max-w-[460px]">
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

      <div className="mt-4">{children}</div>

      {status === "idle" ? (
        <div className="mt-5">
          <Button onClick={round.begin}>{signedIn ? "Start a round" : "Play now"}</Button>
          <p className="mt-3 max-w-[46ch] text-[12.5px] leading-[1.6] text-fg-3">{game.how}</p>
        </div>
      ) : null}

      {status === "loading" ? <p className="mt-5 text-[13px] text-fg-3">Starting…</p> : null}

      {status === "playing" && hint ? (
        <p className="mt-4 text-[12.5px] text-fg-3">{hint}</p>
      ) : null}

      {status === "saving" ? <p className="mt-5 text-[13px] text-fg-3">Saving the round…</p> : null}

      {status === "over" ? (
        <div className="mt-5">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">{ended ?? "Round over."}</p>
          {saved !== null ? (
            <p className="mt-1.5 text-[13px] text-fg-2">
              Scored <span className="mn text-ac-2">{saved}</span> — checked on the server against
              the moves you made.
            </p>
          ) : null}
          {!signedIn ? (
            <p className="mt-1.5 max-w-[46ch] text-[13px] leading-[1.6] text-fg-2">
              Scored <span className="mn text-ac-2">{score}</span>, kept nowhere.{" "}
              <a href="/signin" className="text-ac-2 underline underline-offset-4">
                Sign in
              </a>{" "}
              and rounds are recorded against your account.
            </p>
          ) : null}
          <div className="mt-4">
            <Button onClick={round.begin}>Play again</Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[12.5px] text-amber">{error}</p> : null}
    </div>
  );
}
