"use client";

import { useCallback, useEffect, useState } from "react";
import { CARDS, PAIRS, createRecall } from "@/lib/games/recall";
import { GAMES } from "@/lib/games/catalog";
import { Glyph } from "@/components/games/glyph";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";

/** How long a missed pair stays on the table before it turns back. */
const LOOK_MS = 850;

export function RecallBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const round = useRound({
    game: "recall",
    signedIn,
    personalBest,
    create: useCallback((seed: number) => createRecall(seed), []),
  });
  const { state, status, send } = round;

  /**
   * The pause after a miss is the game, so it lives here rather than in the
   * rules: two cards that did not match stay up until the player turns the next
   * one, and this is the moment in between where they are still looking.
   *
   * The rules do not know about it — nothing about a round's score depends on
   * how long anybody stared — which is why it can be a timer in a component and
   * still replay identically on the server.
   */
  const [concealed, setConcealed] = useState(false);
  const missed = state !== null && state.faceUp.length === 2;

  useEffect(() => {
    setConcealed(false);
    if (!missed) return;

    const timer = setTimeout(() => setConcealed(true), LOOK_MS);
    return () => clearTimeout(timer);
  }, [missed, state]);

  const playing = status === "playing";

  return (
    <RoundFrame
      game={GAMES.recall}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.best ?? 0}
      hint={
        state === null
          ? null
          : `${state.matches} of ${PAIRS} pairs${state.misses > 0 ? `, ${state.misses} missed` : ""}.`
      }
      ended="All pairs found."
    >
      <div className="grid select-none grid-cols-4 gap-2 rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]">
        {Array.from({ length: CARDS }, (_, position) => {
          const card = state?.revealed[position] ?? null;
          const matched = state?.matched[position] ?? false;
          const hidden = concealed && (state?.faceUp.includes(position) ?? false);
          const showing = card !== null && !hidden;

          return (
            <button
              key={position}
              type="button"
              disabled={!playing || matched || showing}
              onClick={() => send(position)}
              aria-label={showing ? `Card ${position + 1}, face up` : `Turn over card ${position + 1}`}
              className={`flex aspect-square items-center justify-center rounded-soft transition-colors duration-200 ${
                matched
                  ? "bg-ac-dim text-ac-2 shadow-[inset_0_0_0_1px_rgba(107,203,165,.3)]"
                  : showing
                    ? "bg-surf-3 text-fg"
                    : "bg-surf-2/50 text-transparent enabled:hover:bg-surf-2"
              }`}
            >
              {showing ? (
                <Glyph shape={card} className="h-[44%] w-[44%]" />
              ) : (
                <span className="size-1.5 rounded-full bg-fg-4/60" />
              )}
            </button>
          );
        })}
      </div>
    </RoundFrame>
  );
}
