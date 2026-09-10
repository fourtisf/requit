import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { LEGAL, operatorIdentified } from "@/lib/legal";

/**
 * Shared shell for Terms, Privacy and the Reward policy.
 *
 * Prose, not product UI: wider line height, a real measure, and headings that
 * can be linked to. These pages are read by offer networks during publisher
 * review as well as by members, so they have to look like documents rather than
 * marketing.
 */
export function LegalPage({
  title,
  summary,
  effective,
  children,
}: {
  title: string;
  summary: string;
  effective: string;
  children: ReactNode;
}) {
  return (
    <>
      <main className="shell py-14">
        <BrandLockup href="/" />

        <header className="mt-12 max-w-[68ch]">
          <h1 className="text-[clamp(28px,4vw,40px)] font-semibold leading-[1.1] tracking-[-0.042em]">
            {title}
          </h1>
          <p className="mt-4 text-[15px] font-light leading-[1.65] text-fg-2">{summary}</p>
          <p className="mn mt-5 text-[12px] text-fg-4">Last updated {effective}</p>
        </header>

        {!operatorIdentified() ? (
          <p className="mt-8 max-w-[68ch] rounded-soft bg-[rgba(232,198,139,.08)] px-[15px] py-3.5 text-[12.5px] leading-[1.6] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]">
            The registered company behind {" "}
            <Link href="/" className="underline underline-offset-2">
              this service
            </Link>{" "}
            is not yet named on this page. Until it is, contact us at{" "}
            <span className="mn">{LEGAL.contactEmail}</span> for anything in this document.
          </p>
        ) : null}

        <article className="legal mt-12 max-w-[68ch]">{children}</article>
      </main>
      <SiteFooter />
    </>
  );
}

export function Section({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-11 scroll-mt-24 first:mt-0">
      <h2 className="text-[19px] font-semibold tracking-[-0.03em]">{heading}</h2>
      <div className="mt-3.5 flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/** A point that has to stand out — a limit, a right, a thing we will not do. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-soft bg-surf px-[15px] py-3.5 text-[13.5px] leading-[1.65] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)]">
      {children}
    </p>
  );
}
