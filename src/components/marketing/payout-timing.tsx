import Link from "next/link";
import { TIER_LADDER, TIER_RULES, holdDescription } from "@/lib/risk";

/**
 * Driven by TIER_RULES — the same table the payout pipeline reads. A marketing
 * page that quotes its own hold windows will eventually quote the wrong ones;
 * this one cannot.
 */
export function PayoutTiming() {
  return (
    <section id="timing" className="shell scroll-mt-20 py-[clamp(62px,8.5vw,116px)]">
      <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">The clock</span>
      <h2 className="mt-3 max-w-[22ch] text-[clamp(1.85rem,3.9vw,2.95rem)] font-semibold leading-[1.08] tracking-[-0.042em] text-balance">
        How long until the money is yours.
      </h2>
      <p className="mt-4 max-w-[56ch] text-[clamp(15px,1.55vw,17.5px)] font-light leading-[1.62] text-fg-2">
        New accounts wait longer, because a reversal can arrive after the fact and a reversal on
        money already sent is a loss nobody recovers. The wait shortens as an account builds a
        record — there is nothing to buy and nothing to apply for.
      </p>

      <div className="mt-[clamp(28px,4vw,46px)] grid gap-px overflow-hidden rounded-card bg-bd shadow-[inset_0_0_0_1px_var(--color-bd)] sm:grid-cols-3">
        {TIER_LADDER.map((tier, index) => (
          <div key={tier} className="bg-bg-2 p-[22px]">
            <div className="flex items-baseline gap-2.5">
              <span className="mn text-[12px] text-fg-4">{index + 1}</span>
              <h3 className="text-[17px] font-semibold tracking-[-0.025em]">
                {TIER_RULES[tier].label}
              </h3>
            </div>
            <p className="mn mt-3 text-[23px] font-semibold leading-none tracking-[-0.045em] text-ac-2">
              {holdDescription(tier)}
            </p>
            <p className="mt-3 text-[13px] font-light leading-[1.6] text-fg-2">
              {TIER_RULES[tier].meaning}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 max-w-[62ch] text-[13px] leading-[1.65] text-fg-3">
        Separately from the hold, an offer has to be confirmed by the network before it counts at
        all — usually minutes, sometimes days. The full rules are in the{" "}
        <Link href="/reward-policy" className="text-ac-2 underline underline-offset-2">
          Reward policy
        </Link>
        .
      </p>
    </section>
  );
}
