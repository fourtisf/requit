"use client";

import { useState, useTransition } from "react";
import type { PollQuestion } from "@/lib/poll/questions";
import type { Tally } from "@/lib/poll/board";

/**
 * Ask, answer, reveal.
 *
 * The reveal is the point. There is nothing to pay a member with today, so what
 * an answer buys is the one thing we can actually give: what everybody else
 * said, which they could not see a moment ago and cannot see without answering.
 *
 * The result is rendered from the response to the same request that recorded
 * the answer. Fetching it separately would put a spinner in the middle of the
 * only interesting second in the interaction.
 */
export function QuestionForm({
  question,
  answered,
  tally,
}: {
  question: PollQuestion;
  /** The option this member already chose, if they have. */
  answered: string | null;
  /** Only ever passed once they have answered — see the note above. */
  tally: Tally | null;
}) {
  const [chosen, setChosen] = useState<string | null>(answered);
  const [result, setResult] = useState<Tally | null>(tally);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function answer(optionId: string) {
    if (chosen !== null || pending) return;
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/poll/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ optionId }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const data = (payload ?? {}) as { answered?: string; tally?: Tally; error?: string };

      if (!response.ok || !data.answered || !data.tally) {
        setError(data.error ?? "That did not go through. Try again.");
        return;
      }

      // The server's answer wins, not the button that was clicked: on a second
      // tab the answer that stands is the first one, and this is where that
      // shows up.
      setChosen(data.answered);
      setResult(data.tally);
    });
  }

  if (chosen === null || result === null) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        {question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={pending}
            onClick={() => answer(option.id)}
            className="rounded-soft bg-surf px-[15px] py-[13px] text-left text-[14px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] transition-colors hover:bg-surf-2 disabled:opacity-50"
          >
            {option.label}
          </button>
        ))}
        {error ? <p className="mt-1 text-[12.5px] text-amber">{error}</p> : null}
        <p className="mt-1 text-[12px] leading-[1.55] text-fg-4">
          You see everyone&rsquo;s answers as soon as you have given yours. Answers are final —
          that is the only thing that keeps the results worth looking at.
        </p>
      </div>
    );
  }

  const mine = result.rows.find((row) => row.option.id === chosen);
  const top = result.rows.reduce((best, row) => (row.count > best.count ? row : best), result.rows[0]!);
  const withMajority = mine !== undefined && mine.option.id === top.option.id && result.total > 1;

  return (
    <div className="mt-4">
      <ul className="flex flex-col gap-2">
        {result.rows.map((row) => {
          const yours = row.option.id === chosen;
          return (
            <li
              key={row.option.id}
              // Both rings written out in full: Tailwind reads the source for
              // class names, so a ring assembled from an interpolation is one
              // that exists in the markup and never in the stylesheet.
              className={
                yours
                  ? "relative overflow-hidden rounded-soft px-[15px] py-[13px] shadow-[inset_0_0_0_1px_rgba(107,203,165,.3)]"
                  : "relative overflow-hidden rounded-soft px-[15px] py-[13px] shadow-[inset_0_0_0_1px_var(--color-bd)]"
              }
            >
              {/* The bar is the row's own background, so a long label never
                  collides with a chart drawn beside it. */}
              <span
                aria-hidden
                style={{ width: `${Math.round(row.share * 100)}%` }}
                className={`absolute inset-y-0 left-0 ${yours ? "bg-[rgba(107,203,165,.18)]" : "bg-surf-2"}`}
              />
              <span className="relative flex items-baseline gap-3">
                <span className={`text-[14px] ${yours ? "text-fg" : "text-fg-2"}`}>
                  {row.option.label}
                  {yours ? <span className="mn ml-2 text-[11px] text-ac-2">yours</span> : null}
                </span>
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
          ? "You are the first to answer today. Check back later and the shares will have moved."
          : withMajority
            ? `${result.total} answers so far, and most of them agree with you.`
            : `${result.total} answers so far. Yours is not the most common one.`}
      </p>

      {/* What the answer is for. It is the difference between a task and a
          form, and it is only a difference if it is on the screen. */}
      <p className="mt-2 max-w-[62ch] text-[12px] leading-[1.6] text-fg-4">
        <span className="text-fg-3">What we do with it:</span> {question.use}
      </p>
    </div>
  );
}
