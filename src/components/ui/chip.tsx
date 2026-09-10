import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ChipTone = "neutral" | "amber";

/**
 * `amber` is reserved for the things a user must know before they start —
 * purchase required, deadline, restricted device. HANDOFF.md §13: an offer whose
 * cost is discovered afterwards is the complaint the whole product exists to
 * avoid, so this tone is never decorative.
 */
export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-[11px] py-1 text-[11.5px] font-normal",
        tone === "neutral" && "bg-surf text-fg-3 shadow-[inset_0_0_0_1px_var(--color-bd)]",
        tone === "amber" &&
          "bg-[rgba(232,198,139,.1)] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.24)]",
      )}
    >
      {children}
    </span>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="mt-[14px] flex flex-wrap gap-1.5">{children}</div>;
}
