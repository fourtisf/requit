import { ButtonLink } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

/**
 * The one thing on this site a visitor can try instead of read.
 *
 * Everything above it is a description of work that is not live yet, which is
 * the weakest possible position for a new site — the reader has only our word.
 * A game they can play in one click is the only claim on the page that checks
 * itself.
 *
 * It promises nothing about earning. That half is not connected, and a CTA
 * hinting otherwise would be the first broken promise a visitor met.
 */
export function PlayCta() {
  return (
    <section id="play" className="shell scroll-mt-20 py-[clamp(40px,6vw,72px)]">
      <div className="rounded-[22px] px-[clamp(22px,4vw,44px)] py-[clamp(30px,4.5vw,54px)] shadow-[inset_0_0_0_1px_var(--color-bd-2)] [background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012))]">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
          <div className="min-w-[min(100%,28ch)] flex-1">
            <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">
              Something to try
            </span>
            <h2 className="mt-3 max-w-[22ch] text-[clamp(1.55rem,3.1vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.038em] text-balance">
              We built a game. Play it without an account.
            </h2>
            <p className="mt-3.5 max-w-[52ch] text-[14.5px] font-light leading-[1.65] text-fg-2">
              Merge matching tiles. Two minutes a round, and it works on a phone. It does not pay
              anything yet — {BRAND.name} has no ad network connected, and we are not going to
              pretend otherwise. Sign in and your scores start being recorded.
            </p>
          </div>

          <ButtonLink href="/play" size="lg">
            Play now
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
