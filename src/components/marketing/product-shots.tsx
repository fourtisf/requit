import Image from "next/image";
import { BRAND } from "@/lib/brand";

/**
 * A picture of the actual software.
 *
 * The site described a product at length and never showed one. A visitor
 * decides in a few seconds whether a thing exists, and a page with no
 * screenshots has the shape of a landing page for something unbuilt, however
 * good the copy is.
 *
 * This is a render of the real screen at the real code, not a mockup. What it
 * contains is a demo account, and the note below says so — a product whose
 * whole argument is "we do not invent numbers" cannot put unlabelled invented
 * numbers on its own homepage.
 */

const POINTS = [
  {
    title: "Every tier, and who actually reaches it",
    body: "Not just the headline. The two hardest tiers here pay $39.80 and $64.30, and 5% and 3% of people get there — so they are struck through rather than used as the number on the poster.",
  },
  {
    title: "Below thirty samples, no percentage at all",
    body: "A completion rate from four data points is a guess with a % sign on it. We would rather show nothing than a figure that moves every time one more person finishes.",
  },
  {
    title: "The cost, before the install",
    body: "An offer that needs a purchase is marked with the amount, in amber, on the card. Finding out afterwards is the single most common complaint in this category.",
  },
  {
    title: "One link, or it cannot be credited",
    body: "The warning under the button is not fine print. An install that did not come through our link cannot be attributed to you by the network, and no dispute can recover it.",
  },
] as const;

const ALT = `The ${BRAND.name} task list. An offer card listing reward tiers, each with the share of people who reached it and what it pays. The two hardest tiers are struck through. A second offer is marked purchase required, fifteen dollars.`;

export function ProductShots() {
  return (
    <section id="product" className="shell scroll-mt-20 py-[clamp(62px,8.5vw,116px)]">
      <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">
        The actual screen
      </span>
      <h2 className="mt-3 max-w-[21ch] text-[clamp(1.85rem,3.9vw,2.95rem)] font-semibold leading-[1.08] tracking-[-0.042em] text-balance">
        See the odds before you spend the evening.
      </h2>
      <p className="mt-4 max-w-[58ch] text-[15px] font-light leading-[1.65] text-fg-2">
        Every offer wall shows one big number. It is nearly always the last tier of a month-long
        grind that a handful of people finish. This is what we show instead.
      </p>

      <figure className="mt-9">
        {/* A hairline plus a deep shadow. The app and the page share a
            background, so without the lift the screenshot reads as more page
            rather than as a window into software. The bottom edge is faded
            because the frame cuts mid-card, and a hard cut reads as a mistake
            while a fade reads as "there is more below". */}
        <div className="overflow-hidden rounded-card shadow-[inset_0_0_0_1px_var(--color-bd-2),0_34px_90px_-34px_rgba(0,0,0,.95)]">
          {/* Two crops, not one scaled down. A desktop screenshot at 390px is
              a grey smudge — the one thing a screenshot must not be — so small
              screens get the app's own phone layout, which was built legible
              at that width. */}
          <Image
            src="/shots/app.png"
            width={2560}
            height={1520}
            alt={ALT}
            className="hidden h-auto w-full [mask-image:linear-gradient(to_bottom,#000_88%,transparent_100%)] sm:block"
            sizes="92vw"
          />
          <Image
            src="/shots/app-mobile.png"
            width={1170}
            height={2160}
            alt={ALT}
            className="block h-auto w-full [mask-image:linear-gradient(to_bottom,#000_88%,transparent_100%)] sm:hidden"
            sizes="96vw"
          />
        </div>
      </figure>

      <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {POINTS.map((point) => (
          <div key={point.title}>
            <h3 className="text-[15.5px] font-semibold tracking-[-0.02em]">{point.title}</h3>
            <p className="mt-2 max-w-[46ch] text-[13.5px] font-light leading-[1.65] text-fg-2">
              {point.body}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-10 max-w-[66ch] text-[12.5px] leading-[1.6] text-fg-4">
        A real screen from the running app. The tasks in it are a demo account — no network has
        approved us yet, so there is no live inventory. Our live figures are on the{" "}
        <a href="/proof" className="text-fg-3 underline underline-offset-4 hover:text-fg">
          proof page
        </a>
        , computed from our own records, and currently zero.
      </p>
    </section>
  );
}
