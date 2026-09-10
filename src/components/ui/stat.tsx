import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The four-up figure grid from the prototype.
 *
 * HANDOFF.md §8: every figure here is computed, never configured. When a value
 * cannot be computed yet, pass `null` — the tile renders an em dash instead of a
 * plausible-looking placeholder, because one invented number costs the whole
 * trust proposition.
 */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-card bg-bd sm:grid-cols-4",
        "shadow-[inset_0_0_0_1px_var(--color-bd)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({ value, label }: { value: string | null; label: string }) {
  return (
    <div className="bg-bg-2 px-[22px] py-6">
      <div className={cn("mn text-[29px] font-semibold leading-none tracking-[-0.05em]", value === null && "text-fg-4")}>
        {value ?? "—"}
      </div>
      <div className="mt-2 text-[12.5px] text-fg-3">{label}</div>
    </div>
  );
}
