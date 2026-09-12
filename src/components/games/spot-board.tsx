"use client";

import { useCallback, useEffect, useState } from "react";
import { createSpot } from "@/lib/games/spot";
import { GAMES } from "@/lib/games/catalog";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";

/**
 * Spot: a grid of one colour, one tile that is not it, and a clock.
 *
 * The clock lives here rather than in the rules, and that is not laziness. A
 * replay can prove the taps were legal; it cannot prove they were quick, and a
 * rule the server cannot check is not a rule, it is a hope. So the timer ends
 * the round and never adds to the score — the points are the levels, exactly as
 * the server recomputes them. What the clock changes is the game: without one,
 * a player simply stares until they find the tile, and the difficulty we
 * designed (the difference shrinking) never bites.
 */

/** Seconds a level, shortening as the tiles get harder to tell apart. */
function secondsFor(level: number): number {
  return Math.max(4, 9 - level * 0.1);
}

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
  const { state, status, send, stop } = round;

  const playing = status === "playing";
  const level = state?.level ?? 1;
  const allowed = secondsFor(level);
  const [left, setLeft] = useState(allowed);

  /**
   * One countdown per level, measured against the wall clock rather than by
   * counting ticks: a throttled background tab would otherwise hand out extra
   * seconds to whoever switched away.
   */
  useEffect(() => {
    if (!playing) {
      setLeft(secondsFor(1));
      return;
    }

    const seconds = secondsFor(level);
    const started = Date.now();
    setLeft(seconds);

    const timer = setInterval(() => {
      const remaining = seconds - (Date.now() - started) / 1000;
      if (remaining > 0) {
        setLeft(remaining);
        return;
      }
      clearInterval(timer);
      setLeft(0);
      stop();
    }, 80);

    return () => clearInterval(timer);
  }, [playing, level, stop]);

  const size = state?.size ?? 3;
  const field = `hsl(${state?.hue ?? 150} 44% ${state?.light ?? 46}%)`;
  const odd = `hsl(${state?.hue ?? 150} 44% ${state?.oddLight ?? 62}%)`;
  const short = left <= 2;

  return (
    <RoundFrame
      game={GAMES.spot}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.best ?? 1}
      hint={state ? `Level ${state.level} — ${left.toFixed(1)}s` : null}
      // The engine only ends a round on a wrong tile, so anything else that
      // stopped it was the clock.
      ended={state?.over ? "That was not the one." : "Out of time."}
    >
      <div className="rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]">
        {/* The clock, as a bar rather than a number: it is read without being
            looked at, which is the only way to read one while hunting a tile. */}
        <div className="mb-2 h-[3px] overflow-hidden rounded-full bg-surf-2">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
              short ? "bg-amber" : "bg-ac"
            }`}
            style={{ width: `${playing ? Math.max(0, (left / allowed) * 100) : 100}%` }}
          />
        </div>

        <div
          className="grid select-none gap-[4px]"
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
      </div>
    </RoundFrame>
  );
}
