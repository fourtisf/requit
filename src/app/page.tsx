import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLockup } from "@/components/ui/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ProductShots } from "@/components/marketing/product-shots";
import { Comparison } from "@/components/marketing/comparison";
import { PayoutTiming } from "@/components/marketing/payout-timing";
import { Faq } from "@/components/marketing/faq";
import { ContractAddress } from "@/components/contract-address";
import { SocialCard } from "@/components/social-card";

/**
 * The public site.
 *
 * Only sections that make no quantitative claim are here. The proof table, the
 * tier tables, the country checker and the dispute SLA are Phase 4 and every
 * figure in them must come from a query (HANDOFF.md §8) — there is nothing to
 * query yet, and a placeholder number on the page whose whole argument is
 * "check our numbers" would end the argument.
 */
export default function Home() {
  return (
    <>
      <header className="shell pt-12">
        <div className="flex flex-wrap items-center gap-4">
          <BrandLockup href="/" />
          <nav className="ml-auto flex items-center gap-0.5">
            {/* The section links are hidden on a phone. They are anchors to
                content the reader scrolls past anyway, and at 400px they push
                the one thing that is not reachable by scrolling — the way in —
                off the right edge. */}
            <span className="hidden gap-0.5 sm:flex">
            {[
              { href: "/#how", label: "How it works" },
              { href: "/#timing", label: "Timing" },
              { href: "/#product", label: "Product" },
              { href: "/#faq", label: "Questions" },
              { href: "/proof", label: "Proof" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg px-[13px] py-[7px] text-[13.5px] text-fg-3 transition-colors hover:bg-surf-2 hover:text-fg"
              >
                {link.label}
              </a>
            ))}
            </span>

            {/* Somebody who already has an account looks top right, which is
                where every site puts this. Without it the only way in was the
                hero button, and that reads as "make a second account". */}
            <Link
              href="/signin"
              className="ml-1.5 rounded-lg bg-surf-2 px-[15px] py-[7px] text-[13.5px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:bg-surf-3"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="shell pt-[clamp(56px,9vw,110px)]">
          <Badge accent="Opening soon">Accounts are open. Tasks are not yet live.</Badge>

          <h1 className="mt-8 max-w-[18ch] text-[clamp(2.5rem,6.4vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.048em] text-balance">
            Advertiser-funded work. <span className="text-fg-3">Paid the same day.</span>
          </h1>

          <p className="mt-6 max-w-[56ch] text-[clamp(15px,1.55vw,17.5px)] font-light leading-[1.62] text-fg-2">
            Finish a task, the offer network confirms it, and {BRAND.name} pays you in USD or ETH
            from $10. The reward, the odds of reaching it, and any purchase required are on screen
            before you start.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            <ButtonLink href="/signin" size="lg">
              Create an account
            </ButtonLink>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full bg-surf-2 px-[26px] py-[14px] text-[15px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:bg-surf-3"
            >
              How it works
            </a>
          </div>

          <p className="mt-5 max-w-[58ch] text-[12.5px] leading-[1.6] text-fg-4">
            We are still being approved by the offer networks that supply the work, so there is
            nothing to complete yet. Nothing on this page is a figure we cannot show you the
            working for — which is why there are no earnings numbers on it.
          </p>
        </section>

        <div className="shell mt-[clamp(48px,7vw,90px)]">
          <div className="hr" />
        </div>

        <HowItWorks />
        <ProductShots />
        <Comparison />
        <PayoutTiming />
        <Faq />

        {/* Placed after the FAQ, not in the hero. The product is paid work; a
            ticker at the top would tell visitors the token is the point, which
            is both untrue and the read that attracts exactly the wrong
            audience. */}
        <section className="shell pb-[clamp(20px,4vw,40px)]">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <ContractAddress />
            <SocialCard />
          </div>
        </section>

        <section className="shell pb-[clamp(20px,4vw,40px)]">
          <div className="relative overflow-hidden rounded-[22px] px-[clamp(24px,4vw,48px)] py-[clamp(38px,6vw,74px)] text-center shadow-[inset_0_0_0_1px_var(--color-bd-2)] [background:linear-gradient(180deg,rgba(255,255,255,.058),rgba(255,255,255,.014))]">
            <div
              aria-hidden
              className="absolute inset-0 [background:radial-gradient(620px_300px_at_50%_0%,rgba(107,203,165,.2),transparent_68%)]"
            />
            <div className="relative">
              <h2 className="mx-auto max-w-[17ch] text-[clamp(1.85rem,3.9vw,2.95rem)] font-semibold leading-[1.08] tracking-[-0.042em] text-balance">
                Your first payout starts with a free account.
              </h2>
              <p className="mx-auto mt-4 max-w-[48ch] text-[14.5px] font-light leading-[1.65] text-fg-2">
                No deposit, no subscription, nothing to buy. Create the account now and you will be
                ready when the first offers go live.
              </p>
              <div className="mt-7 flex justify-center">
                <ButtonLink href="/signin" size="lg">
                  Create an account
                </ButtonLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
