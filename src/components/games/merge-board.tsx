"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SIZE, TARGET, type Board, type Direction, isDirection } from "@/lib/games/merge";
import { createGame, type Game, type GameState } from "@/lib/games/play";
import { Button } from "@/components/ui/button";

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

type Round = { id: string; seed: number };

/**
 * `signedIn` false is a real mode, not a degraded one. A visitor can play the
 * whole game; the only difference is that nothing is recorded, so there is no
 * round to open on the server and no moves to submit. Putting a sign-in wall in
 * front of the one thing on this site a stranger can actually try would waste
 * it.
 */
export function MergeBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const game = useRef<Game | null>(null);
  const moves = useRef<Direction[]>([]);
  const round = useRef<Round | null>(null);

  const [state, setState] = useState<GameState | null>(null);
  const [best, setBest] = useState(personalBest);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "saving" | "over">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const begin = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setSaved(null);

    if (!signedIn) {
      // A guest's seed can come from the browser: with no row to write and no
      // score to keep, there is nothing a chosen seed could win.
      const seed = Math.floor(Math.random() * 2 ** 31);
      round.current = null;
      game.current = createGame(seed);
      moves.current = [];
      setState(game.current.state());
      setStatus("playing");
      return;
    }

    try {
      const response = await fetch("/api/play/start", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not start a round.");
        setStatus("idle");
        return;
      }

      round.current = payload as Round;
      game.current = createGame(payload.seed);
      moves.current = [];
      setState(game.current.state());
      setStatus("playing");
    } catch {
      setError("Could not reach the server.");
      setStatus("idle");
    }
  }, [signedIn]);

  const finish = useCallback(async () => {
    const current = round.current;
    if (!current) {
      // Guest round. Nothing to submit, and the score stays on screen only.
      setStatus("over");
      return;
    }

    setStatus("saving");
    try {
      const response = await fetch("/api/play/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No score in the body. There is deliberately nothing here to inflate.
        body: JSON.stringify({ sessionId: current.id, moves: moves.current }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not save that round.");
      } else {
        setSaved(payload.score);
        setBest((previous) => (payload.score > previous ? payload.score : previous));
      }
    } catch {
      setError("Could not save that round. Your score may not be recorded.");
    } finally {
      setStatus("over");
    }
  }, []);

  const push = useCallback(
    (direction: Direction) => {
      const current = game.current;
      if (!current || status !== "playing") return;

      if (!current.play(direction)) return;
      moves.current.push(direction);

      const next = current.state();
      setState(next);
      if (next.over) void finish();
    },
    [finish, status],
  );

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
      if (!direction || !isDirection(direction)) return;
      event.preventDefault();
      push(direction);
    }

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [push]);

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

    push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  }

  const board: Board = state?.board ?? new Array<number>(SIZE * SIZE).fill(0);
  const reached = state !== null && state.best >= TARGET;

  return (
    <div className="max-w-[440px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mn text-[11.5px] uppercase tracking-[0.08em] text-fg-4">Score</p>
          <p className="mn text-[30px] font-semibold tracking-[-0.03em]">{state?.score ?? 0}</p>
        </div>
        <div className="text-right">
          <p className="mn text-[11.5px] uppercase tracking-[0.08em] text-fg-4">Your best</p>
          <p className="mn text-[17px] text-fg-2">{best}</p>
        </div>
      </div>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="mt-4 grid touch-none select-none grid-cols-4 gap-2 rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]"
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

      {status === "idle" ? (
        <div className="mt-5">
          <Button onClick={begin}>{signedIn ? "Start a round" : "Play now"}</Button>
          <p className="mt-3 max-w-[44ch] text-[12.5px] leading-[1.6] text-fg-3">
            Swipe or use the arrow keys. Two tiles with the same number merge into one. Reach{" "}
            {TARGET} to win — the board carries on afterwards.
          </p>
        </div>
      ) : null}

      {status === "loading" ? <p className="mt-5 text-[13px] text-fg-3">Starting…</p> : null}

      {status === "playing" ? (
        <p className="mt-4 text-[12.5px] text-fg-3">
          {reached ? `${TARGET} reached. Keep going.` : "Swipe, or use the arrow keys."}
        </p>
      ) : null}

      {status === "saving" ? <p className="mt-5 text-[13px] text-fg-3">Saving the round…</p> : null}

      {status === "over" ? (
        <div className="mt-5">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">No moves left.</p>
          {saved !== null ? (
            <p className="mt-1.5 text-[13px] text-fg-2">
              Scored <span className="mn text-ac-2">{saved}</span> — checked on the server against
              the moves you made.
            </p>
          ) : null}
          {!signedIn ? (
            <p className="mt-1.5 max-w-[44ch] text-[13px] leading-[1.6] text-fg-2">
              Scored <span className="mn text-ac-2">{state?.score ?? 0}</span>, kept nowhere.{" "}
              <a href="/signin" className="text-ac-2 underline underline-offset-4">
                Sign in
              </a>{" "}
              and rounds are recorded against your account.
            </p>
          ) : null}
          <div className="mt-4">
            <Button onClick={begin}>Play again</Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[12.5px] text-amber">{error}</p> : null}
    </div>
  );
}
