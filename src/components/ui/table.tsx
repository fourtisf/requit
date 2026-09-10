import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Horizontal scroll container — the proof table has five columns and must not
 *  wrap on a phone. Everything else on the page stays inside the viewport. */
export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-0.5 overflow-x-auto px-0.5">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-bd pb-[11px] pr-[14px] text-left text-[11.5px] font-medium text-fg-4",
        "first:pl-0.5 last:pr-0.5 last:text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        "border-b border-bd py-3 pr-[14px] align-middle text-fg-2",
        "first:pl-0.5 last:pr-0.5 last:text-right",
        className,
      )}
      {...props}
    />
  );
}
