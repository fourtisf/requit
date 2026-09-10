import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** `inset` reads as a well inside another surface; `raised` as a panel on the page. */
  tone?: "raised" | "inset";
};

export function Card({ tone = "raised", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card p-[clamp(18px,2.2vw,26px)]",
        tone === "raised" ? "surface-raised" : "surface-inset",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  aside,
}: {
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-[18px] flex flex-wrap items-baseline gap-[14px]">
      <h3 className="text-[17px] font-semibold tracking-[-0.025em]">{title}</h3>
      {aside ? <span className="ml-auto text-xs text-fg-4">{aside}</span> : null}
    </div>
  );
}
