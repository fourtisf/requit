"use client";

import { useCallback } from "react";
import { COLOURS, MOVE_LIMIT, SIZE, createFlood } from "@/lib/games/flood";
import { GAMES } from "@/lib/games/catalog";
import { Glyph, glyphName } from "@/components/games/glyph";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";

/**
 * Flood's board and its six swatches.
 *
 * The palette is the one place on the site that steps outside the design
 * tokens, and it has to: the system has two colours, and this game needs six
 * that nobody will mistake for each other. They are muted to sit on the dark
 * ground rather than glow off it, and every tile also carries a shape, so the
 * board is playable without seeing colour at all.
 */
const PALETTE: readonly string[] = [
  "#6bcba5", // the site accent, so the board still looks like it belongs here
  "#e8c68b",
  "#7fa6d9",
  "#b98cd4",
  "#d98f77",
  "#8fa0ad",
];

export function FloodBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const round = useRound({
    game: "flood",
    signedIn,
    personalBest,
    create: useCallback((seed: number) => createFlood(seed), []),
  });
  const { state, status, send } = round;

  const board = state?.board ?? new Array<number>(SIZE * SIZE).fill(-1);
  const owned = state?.owned ?? [];
  const corner = state?.board[0] ?? -1;
  const playing = status === "playing";
  const left = state?.left ?? MOVE_LIMIT;

  return (
    <RoundFrame
      game={GAMES.flood}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.filled ?? 0}
      hint={`${left} ${left === 1 ? "move" : "moves"} left.`}
      ended={state?.won ? "Board filled." : "Out of moves."}
    >
      <div className="grid select-none grid-cols-[repeat(12,minmax(0,1fr))] gap-[2px] rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]">
        {board.map((colour, cell) => (
          <div
            key={cell}
            className="flex aspect-square items-center justify-center rounded-[3px] transition-[background-color,opacity] duration-150"
            style={
              colour < 0
                ? { background: "rgba(255,255,255,.05)" }
                : {
                    background: PALETTE[colour],
                    color: "rgba(8,9,10,.42)",
                    // Your patch is the bright part. Without this the corner is
                    // just another tile and the game is played by guesswork.
                    opacity: owned[cell] ? 1 : 0.62,
                  }
            }
          >
            {colour < 0 ? null : <Glyph shape={colour} className="h-[52%] w-[52%]" />}
          </div>
        ))}
      </div>

      {/* The corner's own colour is disabled rather than hidden: a swatch that
          moved every turn would be a moving target on a phone. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: COLOURS }, (_, colour) => {
          const spent = !playing || colour === corner;
          return (
            <button
              key={colour}
              type="button"
              disabled={spent}
              onClick={() => send(colour)}
              aria-label={`Take ${glyphName(colour)}`}
              className={`flex size-11 items-center justify-center rounded-[12px] transition-[transform,opacity] duration-150 ${
                spent ? "opacity-25" : "hover:-translate-y-px"
              }`}
              style={{ background: PALETTE[colour], color: "rgba(8,9,10,.5)" }}
            >
              <Glyph shape={colour} className="size-5" />
            </button>
          );
        })}
      </div>
    </RoundFrame>
  );
}
