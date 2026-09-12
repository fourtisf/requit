"use client";

import { useCallback } from "react";
import { createSpot } from "@/lib/games/spot";
import { GAMES } from "@/lib/games/catalog";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";

/**
 * Spot: a grid of one colour, and one tile that is not it.
 *
 * There is nothing to explain and nothing to configure, which is the whole
 * point of this one being on the shelf. The only thing the board has to get
 * right is the colour: the two shades come out of the rules so that the server
 * replaying the round is looking at the same tile the player was.
 */
export function SpotBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const round = useRound({
    game: "spot",
    signedIn,
    personalBest,
    create: useCallback((seed: number) => createSpot(seed), []),
  });
  const { state, status, send } = round;

  const playing = status === "playing";
  const size = state?.size ?? 3;
  const field = `hsl(${state?.hue ?? 150} 44% ${state?.light ?? 46}%)`;
  const odd = `hsl(${state?.hue ?? 150} 44% ${state?.oddLight ?? 62}%)`;

  return (
    <RoundFrame
      game={GAMES.spot}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.best ?? 1}
      hint={state ? `Level ${state.level} — take your time.` : null}
      ended="That was not the one."
    >
      <div
        className="grid select-none gap-[4px] rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: size * size }, (_, cell) => (
          <button
            key={cell}
            type="button"
            disabled={!playing}
            onClick={() => send(cell)}
            aria-label={`Tile ${cell + 1}`}
            className="aspect-square rounded-soft transition-transform duration-100 active:scale-95"
            style={{ background: state !== null && cell === state.odd ? odd : field }}
          />
        ))}
      </div>
    </RoundFrame>
  );
}
