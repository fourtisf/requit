import { TaskKindsGrid } from "@/components/task-kinds-grid";

/**
 * "So what would I actually be doing?"
 *
 * The site explained where the money comes from, when it is paid, and how to
 * dispute it — and never once said what the work is. That is the first question
 * anyone asks, and leaving it unanswered is what makes a paid-tasks site read
 * as a scheme rather than a job board.
 *
 * No figures anywhere in here; task-kinds.test.ts enforces it. What a task pays
 * is on the task.
 */
export function TaskKindsSection() {
  return (
    <section id="tasks" className="shell scroll-mt-20 py-[clamp(62px,8.5vw,116px)]">
      <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">The work</span>
      <h2 className="mt-3 max-w-[20ch] text-[clamp(1.85rem,3.9vw,2.95rem)] font-semibold leading-[1.08] tracking-[-0.042em] text-balance">
        What you would actually be doing.
      </h2>
      <p className="mt-4 max-w-[58ch] text-[clamp(15px,1.55vw,17.5px)] font-light leading-[1.62] text-fg-2">
        Six kinds of task, set by the advertiser, not by us. Each one says what releases the money
        and what can go wrong — before you start, which is the only time it is any use.
      </p>

      <div className="mt-[clamp(32px,4vw,52px)]">
        <TaskKindsGrid />
      </div>

      <p className="mt-6 max-w-[64ch] text-[13px] leading-[1.7] text-fg-3">
        Which of these are live depends on your country and your device, and it changes week to
        week. We do not publish an earnings figure, because anyone who does is guessing — the
        reward, the deadline, any purchase required, and the share of people who reached each tier
        are on the task itself.
      </p>
    </section>
  );
}
