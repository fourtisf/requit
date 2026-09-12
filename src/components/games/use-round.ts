"use client";

import { useCallback, useRef, useState } from "react";
import type { GameSlug } from "@/lib/games/catalog";
import type { Engine, RoundState } from "@/lib/games/engine";
import { play } from "@/components/games/sound";
import { dailySeed } from "@/lib/games/daily";

/**
 * A round, from the button that opens it to the score the server writes down.
 *
 * Every board on the site does the same four things — ask the server for a
 * seed, run the engine, keep the moves, send them back when the game ends — and
 * the only part that differs is what a move is. Doing that once here is not
 * only tidier: the rule that a score is never sent to the server lives in one
 * function rather than being re-honoured by each new game.
 *
 * `signedIn` false is a real mode, not a degraded one. A visitor can play any
 * game here start to finish; the only difference is that nothing is recorded,
 * so there is no round to open and no moves to submit. Putting a sign-in wall
 * in front of the one part of this site a stranger can actually try would waste
 * it.
 */

export type RoundStatus = "idle" | "loading" | "playing" | "saving" | "over";

export type Round<TMove, TState> = {
  state: TState | null;
  status: RoundStatus;
  error: string | null;
  /** The score the server replayed and stored. Null until it has, or for a guest. */
  saved: number | null;
  /** The player's best, updated the moment the server beats it. */
  best: number;
  /** `daily` opens today's board — the one everybody else is playing. */
  begin: (daily?: boolean) => void;
  /** Plays a move. False when the rules refused it — the board can ignore it. */
  send: (move: TMove) => boolean;
  /**
   * Ends the round now and sends what was played.
   *
   * For a game that can stop for a reason the rules do not model — a clock.
   * The rules stay time-free on purpose: a replay can prove the moves were
   * legal and can never prove they were fast, so the clock belongs to the
   * board, and the score is still only what the moves earned.
   */
  stop: () => void;
};

export function useRound<TMove, TState extends RoundState>({
  game,
  signedIn,
  personalBest,
  create,
  clicks = true,
}: {
  game: GameSlug;
  signedIn: boolean;
  personalBest: number;
  create: (seed: number) => Engine<TMove, TState>;
  /**
   * Whether an ordinary move makes a noise.
   *
   * False for a game that moves on a timer: Trail sends a move eight times a
   * second, and a click on each of them is not feedback, it is a fault.
   */
  clicks?: boolean;
}): Round<TMove, TState> {
  const engine = useRef<Engine<TMove, TState> | null>(null);
  const moves = useRef<TMove[]>([]);
  const round = useRef<{ id: string } | null>(null);
  // Whether moves are still being taken. A ref rather than the status, because
  // a game that runs on a timer reads it from inside an interval, where a
  // captured piece of state would be one tick stale.
  const live = useRef(false);

  const [state, setState] = useState<TState | null>(null);
  const [best, setBest] = useState(personalBest);
  const [status, setStatus] = useState<RoundStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const open = useCallback(
    (seed: number, id: string | null) => {
      round.current = id === null ? null : { id };
      engine.current = create(seed);
      moves.current = [];
      live.current = true;
      setState(engine.current.state());
      setStatus("playing");
    },
    [create],
  );

  const begin = useCallback(
    (daily = false) => {
      setError(null);
      setSaved(null);

      if (!signedIn) {
        // A guest plays the same board as everybody else when they ask for it;
        // it simply is not recorded, so it cannot be ranked. The random seed
        // can come from the browser: with no row to write and no score to
        // keep, there is nothing a chosen seed could win.
        open(daily ? dailySeed(game) : Math.floor(Math.random() * 2 ** 31), null);
        return;
      }

      setStatus("loading");
      void (async () => {
        try {
          const response = await fetch("/api/play/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game, daily }),
          });
          const payload = await response.json();
          if (!response.ok) {
            setError(payload.error ?? "Could not start a round.");
            setStatus("idle");
            return;
          }
          open(payload.seed as number, payload.id as string);
        } catch {
          setError("Could not reach the server.");
          setStatus("idle");
        }
      })();
    },
    [game, open, signedIn],
  );

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
        setBest((previous) =>
          payload.score > previous ? payload.score : previous,
        );
      }
    } catch {
      setError("Could not save that round. Your score may not be recorded.");
    } finally {
      setStatus("over");
    }
  }, []);

  const stop = useCallback(() => {
    if (!live.current) return;
    live.current = false;
    void finish();
  }, [finish]);

  const send = useCallback(
    (move: TMove) => {
      const current = engine.current;
      if (!current || !live.current) return false;
      if (!current.play(move)) return false;

      moves.current.push(move);
      const before = state?.score ?? 0;
      const next = current.state();
      setState(next);

      if (next.score > before) play("score");
      else if (clicks) play("tap");

      if (next.over) {
        play("end");
        live.current = false;
        void finish();
      }
      return true;
    },
    [clicks, finish, state],
  );

  return { state, status, error, saved, best, begin, send, stop };
}
