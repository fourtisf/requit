import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { GAME_LIST } from "@/lib/games/catalog";
import { BRAND } from "@/lib/brand";

/**
 * The one thing on this site a visitor can try instead of read.
 *
 * Everything above it is a description of work that is not live yet, which is
 * the weakest possible position for a new site — the reader has only our word.
 * A game they can play in one click is the only claim on the page that checks
 * itself, and the games are named here rather than hidden behind the button so
 * that the click is a choice rather than a leap.
 *
 * It promises nothing about earning. That half is not connected, and a CTA
 * hinting otherwise would be the first broken promise a visitor met.
 */
/** A headline reads "six games", not "6 games". The shelf's own label can count. */
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

export function PlayCta() {
  const count = WORDS[GAME_LIST.length] ?? String(GAME_LIST.length);

  return (
    <section id="play" className="shell scroll-mt-20 py-[clamp(40px,6vw,72px)]">
      <div className="rounded-[22px] px-[clamp(22px,4vw,44px)] py-[clamp(30px,4.5vw,54px)] shadow-[inset_0_0_0_1px_var(--color-bd-2)] [background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012))]">
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6">
          <div className="min-w-[min(100%,28ch)] flex-1">
            <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">
              Something to try
            </span>
            <h2 className="mt-3 max-w-[22ch] text-[clamp(1.55rem,3.1vw,2.3rem)] font-semibold leading-[1.1] tracking-[-0.038em] text-balance">
              We built {count} games. Play them without an account.
            </h2>
            <p className="mt-3.5 max-w-[52ch] text-[14.5px] font-light leading-[1.65] text-fg-2">
              Two minutes a round, and they work on a phone. They do not pay anything yet —{" "}
              {BRAND.name} has no ad network connected, and we are not going to pretend otherwise.
              Sign in and your scores start being recorded.
            </p>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {GAME_LIST.map((game) => (
                <Link
                  key={game.slug}
                  href={`/play/${game.slug}`}
                  className="rounded-full bg-surf px-[13px] py-[6px] text-[12.5px] text-fg-2 shadow-[inset_0_0_0_1px_var(--color-bd)] transition-colors hover:bg-surf-2 hover:text-fg"
                >
                  {game.title}
                </Link>
              ))}
            </div>
          </div>

          <ButtonLink href="/play" size="lg">
            Play now
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
