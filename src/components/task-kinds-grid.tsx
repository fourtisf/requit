import { TASK_KINDS, TASK_KIND_ORDER } from "@/lib/task-kinds";

/**
 * The six kinds of work, as cards. Shared by the public page and the empty task
 * list so the two can never describe the product differently.
 */
export function TaskKindsGrid({ compact = false }: { compact?: boolean }) {
  return (
    <ul
      className={
        compact
          ? "grid gap-2.5 sm:grid-cols-2"
          : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {TASK_KIND_ORDER.map((category) => {
        const kind = TASK_KINDS[category];
        return (
          <li
            key={category}
            className={
              compact
                ? "rounded-card px-[18px] py-4 surface-inset"
                : "surface-raised rounded-card p-[clamp(19px,2.3vw,26px)]"
            }
          >
            <span className="mn text-[11.5px] uppercase tracking-[0.08em] text-fg-4">
              {category.toLowerCase()}
            </span>
            <h3 className="mt-2 text-[16px] font-semibold tracking-[-0.025em]">
              {kind.title}
            </h3>
            <p className="mt-2 text-[13.5px] font-light leading-[1.65] text-fg-2">
              {kind.body}
            </p>

            <p className="mt-3 text-[12.5px] leading-[1.6] text-fg-3">
              <span className="text-ac-2">Paid when</span> {kind.paidWhen}
            </p>

            {kind.caveat ? (
              <p className="mt-2 text-[12.5px] leading-[1.6] text-fg-3">
                <span className="text-amber">The catch</span> {kind.caveat}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
