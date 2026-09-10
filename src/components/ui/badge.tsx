import type { ReactNode } from "react";

/** The pill above the hero: a quiet label with one highlighted token. */
export function Badge({ accent, children }: { accent?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[9px] rounded-full bg-surf py-1.5 pl-[7px] pr-[15px] text-[12.5px] font-normal text-fg-2 shadow-[inset_0_0_0_1px_var(--color-bd)]">
      {accent ? (
        <b className="rounded-full bg-ac-dim px-[9px] py-[3px] text-[11px] font-semibold text-ac-2">
          {accent}
        </b>
      ) : null}
      {children}
    </span>
  );
}

/** The settled/confirmed marker on the proof table. */
export function OkDot({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ac-2">
      <span className="size-[5px] shrink-0 rounded-full bg-ac" />
      {children}
    </span>
  );
}
