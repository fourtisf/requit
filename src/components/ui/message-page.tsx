import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";

/**
 * Shared shell for the pages a user only sees when something has gone wrong.
 * Same surface as the rest of the product on purpose — an unstyled error page
 * reads as "this site is broken", which is expensive for a product whose whole
 * argument is that it can be trusted with money.
 */
export function MessagePage({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="shell flex min-h-dvh items-center justify-center py-20">
      <div className="w-full max-w-[440px]">
        <div className="flex items-center gap-[9px] text-[15px] font-semibold tracking-[-0.03em]">
          <span className="size-[19px] shrink-0 rounded-[5.5px] bg-[linear-gradient(148deg,#fff,#A9E7CD_58%,#3E9878)] shadow-[0_0_14px_rgba(107,203,165,.36)]" />
          {BRAND.name}
        </div>

        <h1 className="mt-7 text-[27px] font-semibold leading-tight tracking-[-0.042em]">
          {title}
        </h1>

        <div className="mt-2.5 text-[13.5px] leading-[1.6] text-fg-2">{children}</div>

        {action ? <div className="mt-7">{action}</div> : null}
      </div>
    </main>
  );
}
