import Link from "next/link";
import { BRAND } from "@/lib/brand";

const QUESTIONS = [
  {
    q: "How much can I actually earn?",
    a: "We will not give you a number, because anyone who does is guessing. It depends on your country, your device, and which offers are live that week — and offer inventory changes constantly. What we will do is show the real reward and the real completion rate for every offer before you start, so you can decide for yourself.",
  },
  {
    q: `Do I need ${BRAND.ticker} to earn?`,
    a: `No. Completing offers and getting paid has nothing to do with any token. ${BRAND.ticker} is not sold here and is not required for anything.`,
  },
  {
    q: "What if an offer doesn't track?",
    a: "Open a dispute from your account. It gets a status you can watch move, and we take it to the network. Sometimes the advertiser refuses, and when that happens we tell you it was refused rather than letting it go quiet. The one thing we cannot fix is an offer you started outside our link — the network has no way to attribute that to you.",
  },
  {
    q: "Why do some offers require a purchase?",
    a: "Because the advertiser is paying for a customer, not a click. Those offers pay far more, and they are labelled with the amount before you open them. The purchase is between you and that advertiser — we cannot refund or cancel it.",
  },
  {
    q: "Which wallets do I need?",
    a: "One for Solana or one for Base, depending on how you want to be paid. You prove it is yours by signing a message. We never ask for a seed phrase, and we never ask you to send a transaction to verify.",
  },
  {
    q: "Is this employment?",
    a: "No. You choose what to do and when, and a reward is payment for completing a specific offer — not a wage and not guaranteed income.",
  },
] as const;

export function Faq() {
  return (
    <section id="faq" className="shell scroll-mt-20 py-[clamp(62px,8.5vw,116px)]">
      <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">Questions</span>
      <h2 className="mt-3 max-w-[18ch] text-[clamp(1.85rem,3.9vw,2.95rem)] font-semibold leading-[1.08] tracking-[-0.042em] text-balance">
        The ones people actually ask.
      </h2>

      <div className="mt-[clamp(28px,4vw,44px)] max-w-[820px]">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group border-b border-bd first:border-t">
            <summary className="relative cursor-pointer list-none py-[18px] pr-9 text-[15.5px] font-medium tracking-[-0.02em] [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden
                className="absolute right-1.5 top-[26px] size-[9px] rotate-45 border-b-[1.5px] border-r-[1.5px] border-fg-3 transition-transform group-open:top-[29px] group-open:-rotate-[135deg]"
              />
            </summary>
            <p className="max-w-[72ch] pb-5 text-[14.5px] font-light leading-[1.65] text-fg-2">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <p className="mt-8 text-[13.5px] text-fg-3">
        Anything else:{" "}
        <a
          href={`mailto:${BRAND.supportEmail}`}
          className="mn text-ac-2 underline underline-offset-4"
        >
          {BRAND.supportEmail}
        </a>{" "}
        · Read the{" "}
        <Link href="/reward-policy" className="text-ac-2 underline underline-offset-4">
          Reward policy
        </Link>
        .
      </p>
    </section>
  );
}
