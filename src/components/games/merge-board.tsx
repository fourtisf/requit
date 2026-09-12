"use client";

import { useCallback, useEffect, useRef } from "react";
import { SIZE, TARGET, type Board, type Direction } from "@/lib/games/merge";
import { createGame } from "@/lib/games/play";
import { GAMES } from "@/lib/games/catalog";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";
import { KeyCoach } from "@/components/games/key-coach";

/**
 * The board.
 *
 * It runs the same engine the server runs, and keeps every move it makes. When
 * the round ends the move list goes up and the server replays it — the score on
 * screen is this browser's opinion, and the score in the database is the
 * server's. They agree because both came out of the same functions, not because
 * anyone was trusted.
 */

const TILE: Record<number, string> = {
  2: "bg-surf-2 text-fg-2",
  4: "bg-surf-3 text-fg-2",
  8: "bg-[rgba(107,203,165,.16)] text-ac-2",
  16: "bg-[rgba(107,203,165,.24)] text-ac-2",
  32: "bg-[rgba(107,203,165,.34)] text-ac-2",
  64: "bg-[rgba(107,203,165,.46)] text-fg",
  128: "bg-[rgba(232,198,139,.22)] text-amber",
  256: "bg-[rgba(232,198,139,.32)] text-amber",
  512: "bg-[rgba(232,198,139,.44)] text-amber",
  1024: "bg-[rgba(232,198,139,.58)] text-bg",
  2048: "bg-amber text-bg",
};

function tileClass(value: number): string {
  return TILE[value] ?? "bg-amber text-bg";
}

/** Long numbers have to shrink or they spill out of the square. */
function tileSize(value: number): string {
  if (value >= 1024) return "text-[clamp(15px,4.6vw,24px)]";
  if (value >= 128) return "text-[clamp(18px,5.4vw,29px)]";
  return "text-[clamp(21px,6.2vw,34px)]";
}

export function MergeBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const round = useRound({
    game: "merge",
    signedIn,
    personalBest,
    create: useCallback((seed: number) => createGame(seed), []),
  });
  const { state, send } = round;

  // Keyboard. Arrow keys and WASD, and preventDefault so arrows do not scroll
  // the page out from under the board mid-game.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const map: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const direction = map[event.key];
      if (!direction) return;
      event.preventDefault();
      send(direction);
    }

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);

  // Touch. Most people will play this on a phone, so a swipe has to work as
  // well as a key — and has to not be confused with a scroll.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const MIN_SWIPE = 24;

  function onTouchStart(event: React.TouchEvent) {
    const point = event.touches[0];
    if (point) touch.current = { x: point.clientX, y: point.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const startPoint = touch.current;
    const point = event.changedTouches[0];
    touch.current = null;
    if (!startPoint || !point) return;

    const dx = point.clientX - startPoint.x;
    const dy = point.clientY - startPoint.y;
    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

    send(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  const board: Board = state?.board ?? new Array<number>(SIZE * SIZE).fill(0);
  const reached = state !== null && state.best >= TARGET;

  return (
    <RoundFrame
      game={GAMES.merge}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.best ?? 0}
      hint={
        reached ? (
          `${TARGET} reached. Keep going.`
        ) : (
          <>
            <span className="mn text-fg">← ↑ → ↓</span> to slide the tiles — or swipe.
          </>
        )
      }
      ended="No moves left."
      // Until the first move lands, the board shows which keys it wants.
      coach={state !== null && state.moves === 0 ? <KeyCoach /> : null}
    >
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="grid touch-none select-none grid-cols-4 gap-2 rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]"
      >
        {board.map((value, index) => (
          <div
            key={index}
            className={`flex aspect-square items-center justify-center rounded-soft font-semibold tabular-nums transition-colors ${
              value === 0 ? "bg-surf-2/40" : tileClass(value)
            } ${tileSize(value)}`}
          >
            {value === 0 ? "" : value}
          </div>
        ))}
      </div>
    </RoundFrame>
  );
}
