import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

/**
 * The mark. One definition, the same reasoning as `BRAND` in lib/brand.ts —
 * before this it was pasted into five files, so changing it meant finding all
 * five.
 *
 * `currentColor` is not used: the two chevrons are deliberately different
 * colours, and the accent has to stay the accent wherever it lands.
 */
export function BrandMark({ size = 19, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path d="M7.5 7.5 16 16 7.5 24.5Z" fill="#FBFBFA" />
      <path d="M17 7.5 25.5 16 17 24.5Z" fill="#6BCBA5" />
    </svg>
  );
}

/**
 * Mark plus name. Pass `href` to make it a link — the nav does, the sign-in and
 * error pages do not, because a logo that navigates away from a half-finished
 * sign-in is a trap.
 */
export function BrandLockup({
  href,
  size = 19,
  className,
}: {
  href?: "/" | "/dashboard";
  size?: number;
  className?: string;
}) {
  const content: ReactNode = (
    <>
      <BrandMark size={size} />
      {BRAND.name}
    </>
  );

  const classes = cn(
    "flex items-center gap-[9px] text-[15px] font-semibold tracking-[-0.03em]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
