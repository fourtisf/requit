"use client";

import { useCallback, useEffect, useRef } from "react";
import { type Direction, opposite } from "@/lib/games/direction";
import { SIZE, createTrail } from "@/lib/games/trail";
import { GAMES } from "@/lib/games/catalog";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";
import { KeyCoach } from "@/components/games/key-coach";

/**
 * Trail's board, which is the only one here that moves on its own.
 *
 * The timer is presentation and nothing else: it decides when the next tick is
 * sent, and the rules decide what a tick does. That separation is why a slow
 * phone and a fast one play the same game, and why speeding the clock up buys a
 * cheat nothing — every tick is still a move that has to survive the replay.
 */

/** Milliseconds a tick. Shortens as the trail grows, to a floor. */
function pace(length: number): number {
  return Math.max(75, 155 - (length - 3) * 4);
}

/**
 * Turns wait their turn.
 *
 * A player rounding a corner presses two directions inside one tick, and
 * dropping the second is the single most annoying thing a snake game does. Two
 * are held; a third would be the player hammering keys, and playing that back
 * is worse than ignoring it.
 */
const QUEUE_LIMIT = 2;

export function TrailBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const round = useRound({
    game: "trail",
    signedIn,
    personalBest,
    create: useCallback((seed: number) => createTrail(seed), []),
    // A move here is a tick of the clock, not a decision. Only fruit and the
    // wall are worth hearing.
    clicks: false,
  });
  const { state, status, send } = round;

  const queue = useRef<Direction[]>([]);
  const heading = useRef<Direction>("right");
  useEffect(() => {
    if (state) heading.current = state.heading;
  }, [state]);

  const turn = useCallback((direction: Direction) => {
    const pending = queue.current;
    const last = pending.length > 0 ? pending[pending.length - 1]! : heading.current;
    // A reversal is refused by the rules, and a repeat of the current heading
    // is not a turn. Neither is worth a slot.
    if (direction === last || direction === opposite(last)) return;
    if (pending.length >= QUEUE_LIMIT) return;
    pending.push(direction);
  }, []);

  useEffect(() => {
    // Turns queued as the last round ended are not turns in this one.
    if (status !== "playing") {
      queue.current = [];
      return;
    }

    const timer = setInterval(() => {
      const next = queue.current.shift() ?? heading.current;
      // A queued turn can only be refused if something got out of step; carry
      // straight on rather than losing the tick.
      if (!send(next)) send(heading.current);
    }, pace(state?.snake.length ?? 3));

    return () => clearInterval(timer);
  }, [send, state?.snake.length, status]);

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
      turn(direction);
    }

    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  // A shorter swipe than the merge board asks for: steering wants to feel
  // immediate, and there is nothing on this board a stray flick can spoil.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const MIN_SWIPE = 16;

  function onTouchStart(event: React.TouchEvent) {
    const point = event.touches[0];
    if (point) touch.current = { x: point.clientX, y: point.clientY };
  }

  function onTouchMove(event: React.TouchEvent) {
    const from = touch.current;
    const point = event.touches[0];
    if (!from || !point) return;

    const dx = point.clientX - from.x;
    const dy = point.clientY - from.y;
    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    // Start measuring again from here, so a long drag can steer twice.
    touch.current = { x: point.clientX, y: point.clientY };
  }

  const snake = state?.snake ?? [];
  const head = snake[0];
  const body = new Set(snake.slice(1));
  const length = snake.length;

  return (
    <RoundFrame
      game={GAMES.trail}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={length}
      hint={
        <>
          <span className="mn text-fg">← ↑ → ↓</span> to steer — or swipe.
        </>
      }
      ended="You ran out of room."
      // The trail moves on its own, so this goes as soon as it is steered once.
      coach={state !== null && state.heading === "right" && length === 3 ? <KeyCoach /> : null}
    >
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        className="grid touch-none select-none grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px] rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]"
      >
        {Array.from({ length: SIZE * SIZE }, (_, cell) => {
          const isHead = cell === head;
          const isBody = body.has(cell);
          const isFruit = state !== null && cell === state.fruit;

          return (
            <div
              key={cell}
              className={`aspect-square rounded-[3px] ${
                isHead
                  ? "bg-ac-2"
                  : isBody
                    ? "bg-[rgba(107,203,165,.45)]"
                    : isFruit
                      ? "bg-amber"
                      : "bg-surf-2/40"
              }`}
            />
          );
        })}
      </div>
    </RoundFrame>
  );
}
