import Link from "next/link";
import type { Route } from "next";
import { Card, CardHeader } from "@/components/ui/card";
import { readinessFor } from "@/lib/readiness";

/**
 * The list of things a member can finish today.
 *
 * The first sentence is the refusal, and it stays first: none of this pays.
 * Putting a progress count on a list that quietly implied earnings would be the
 * oldest trick in this category — a bar to fill instead of a product.
 *
 * What it is honestly for is the day tasks arrive. A member with a verified
 * wallet and a country on file gets paid that day; one without either becomes a
 * support ticket at the worst possible moment.
 */
export async function ReadinessCard({ userId }: { userId: string }) {
  const { steps, done, total } = await readinessFor(userId);
  const finished = done === total;

  return (
    <Card>
      <CardHeader
        title={finished ? "You are ready" : "What you can do today"}
        aside={<span className="mn">{`${done}/${total}`}</span>}
      />

      <p className="-mt-2 mb-4 max-w-[62ch] text-[13px] leading-[1.6] text-fg-3">
        {finished
          ? "Everything that can be done before there is work to do is done. Nothing here paid anything — the first thing that pays is a task, and we will say when those are live."
          : "None of these pay. There are no tasks yet, and these are the things that make the day there are tasks a good day rather than a queue."}
      </p>

      <ul>
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-bd py-[13px] first:border-t-0 first:pt-0"
          >
            <span
              aria-hidden
              className={`mt-[6px] size-[7px] shrink-0 rounded-full ${
                step.done ? "bg-ac" : "bg-fg-4"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-[13.5px] ${step.done ? "text-fg-3 line-through" : "text-fg"}`}>
                {step.title}
              </p>
              {step.done ? null : (
                <p className="mt-1 max-w-[58ch] text-[12.5px] leading-[1.55] text-fg-3">
                  {step.why}
                </p>
              )}
            </div>

            {step.href === null ? (
              <span className="mn shrink-0 text-[11.5px] text-ac-2">{step.action}</span>
            ) : (
              <Link
                href={step.href as Route}
                className={`shrink-0 text-[12.5px] underline underline-offset-4 ${
                  step.done ? "text-fg-4 hover:text-fg-3" : "text-ac-2"
                }`}
              >
                {step.action}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
