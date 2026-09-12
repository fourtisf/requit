"use client";

import { useState, useTransition } from "react";
import type { PollQuestion } from "@/lib/poll/questions";
import type { Tally } from "@/lib/poll/board";

/**
 * Answer, call, reveal.
 *
 * Two moves, in this order and never the other. The answer is the task and is
 * not scored — there is no right device to be reading this on. The call is the
 * game: which answer will most people have picked. Asking for the answer first
 * is what keeps the survey honest, because by the time anybody is thinking
 * about winning, their own answer is already in.
 *
 * The reveal shows today's shares, which are not the result — the day is still
 * open and the crowd is still arriving. The call settles at midnight UTC and
 * the card says so tomorrow. That wait is the round ending, and it is the
 * reason to come back that is not a prize.
 */
export function QuestionForm({
  question,
  answered,
  called,
  tally,
}: {
  question: PollQuestion;
  answered: string | null;
  called: string | null;
  tally: Tally | null;
}) {
  const [mine, setMine] = useState<string | null>(answered);
  const [call, setCall] = useState<string | null>(called);
  const [result, setResult] = useState<Tally | null>(tally);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send(prediction: string) {
    if (mine === null || pending) return;
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/poll/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId: mine, predictedOptionId: prediction }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const data = (payload ?? {}) as {
        answered?: string;
        called?: string | null;
        tally?: Tally;
        error?: string;
      };

      if (!response.ok || !data.answered || !data.tally) {
        setError(data.error ?? "That did not go through. Try again.");
        return;
      }

      // The server's row wins over the buttons that were clicked: on a second
      // tab the answer that stands is the first one, and this is where it shows.
      setMine(data.answered);
      setCall(data.called ?? prediction);
      setResult(data.tally);
    });
  }

  // ── Move one: the answer ────────────────────────────────────────────────
  if (mine === null) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((option) => (
          <Choice key={option.id} label={option.label} onClick={() => setMine(option.id)} />
        ))}
        <p className="mt-1 text-[12px] leading-[1.55] text-fg-4">
          Your own answer first. It is never scored — there is no right one — and it is what the
          result is made of.
        </p>
      </div>
    );
  }

  // ── Move two: the call ──────────────────────────────────────────────────
  if (call === null || result === null) {
    return (
      <div className="mt-4">
        <p className="text-[13px] leading-[1.6] text-fg-2">
          You answered{" "}
          <span className="text-fg">
            {question.options.find((option) => option.id === mine)?.label}
          </span>
          . Now call it:{" "}
          <span className="text-fg">which answer will most people have picked today?</span>
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {question.options.map((option) => (
            <Choice
              key={option.id}
              label={option.label}
              yours={option.id === mine}
              disabled={pending}
              onClick={() => send(option.id)}
            />
          ))}
        </div>

        {error ? <p className="mt-2 text-[12.5px] text-amber">{error}</p> : null}
        <p className="mt-2 text-[12px] leading-[1.55] text-fg-4">
          It settles at midnight UTC, when the day closes and the count stops moving. You find out
          tomorrow — nobody can call it after seeing the result.
        </p>
        <button
          type="button"
          onClick={() => setMine(null)}
          className="mt-3 text-[12.5px] text-fg-3 transition-colors hover:text-fg"
        >
          Change my answer
        </button>
      </div>
    );
  }

  // ── The reveal ──────────────────────────────────────────────────────────
  const label = (id: string) => question.options.find((option) => option.id === id)?.label ?? id;
  const leader = result.rows.reduce((best, row) => (row.count > best.count ? row : best), result.rows[0]!);
  const leading = call === leader.option.id && result.total > 1;

  return (
    <div className="mt-4">
      <ul className="flex flex-col gap-2">
        {result.rows.map((row) => {
          const yours = row.option.id === mine;
          const theCall = row.option.id === call;
          return (
            <li
              key={row.option.id}
              className={
                yours
                  ? "relative overflow-hidden rounded-soft px-[15px] py-[13px] shadow-[inset_0_0_0_1px_rgba(107,203,165,.3)]"
                  : "relative overflow-hidden rounded-soft px-[15px] py-[13px] shadow-[inset_0_0_0_1px_var(--color-bd)]"
              }
            >
              <span
                aria-hidden
                style={{ width: `${Math.round(row.share * 100)}%` }}
                className={`absolute inset-y-0 left-0 ${yours ? "bg-[rgba(107,203,165,.18)]" : "bg-surf-2"}`}
              />
              <span className="relative flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className={`text-[14px] ${yours ? "text-fg" : "text-fg-2"}`}>
                  {row.option.label}
                </span>
                {yours ? <span className="mn text-[11px] text-ac-2">yours</span> : null}
                {theCall ? <span className="mn text-[11px] text-amber">your call</span> : null}
                <span className="mn ml-auto shrink-0 text-[12.5px] tabular-nums text-fg-3">
                  {Math.round(row.share * 100)}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[12.5px] leading-[1.6] text-fg-3">
        {result.total === 1
          ? `You are the first today. You called ${label(call)} — come back tomorrow and see.`
          : leading
            ? `${result.total} answers so far, and ${label(call)} is ahead. Your call is winning, but the day is not over.`
            : `${result.total} answers so far, and “${leader.option.label}” is ahead of your call.`}
      </p>

      <p className="mt-2 max-w-[62ch] text-[12px] leading-[1.6] text-fg-4">
        <span className="text-fg-3">What we do with it:</span> {question.use}
      </p>
    </div>
  );
}

function Choice({
  label,
  yours,
  disabled,
  onClick,
}: {
  label: string;
  yours?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-soft bg-surf px-[15px] py-[13px] text-left text-[14px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] transition-colors hover:bg-surf-2 disabled:opacity-50"
    >
      <span>{label}</span>
      {yours ? <span className="mn ml-auto text-[11px] text-ac-2">your answer</span> : null}
    </button>
  );
}
