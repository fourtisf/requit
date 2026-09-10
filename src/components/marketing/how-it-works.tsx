import { BRAND } from "@/lib/brand";

const STEPS = [
  {
    title: "An advertiser buys a customer",
    body: "A studio or app pays an offer network for a verified action — an install, a signup, a level reached.",
  },
  {
    title: "You complete it",
    body: "Reward, eligibility, deadline and any purchase requirement are on screen before you start. Never after.",
  },
  {
    title: "The network confirms",
    body: "Payment releases on the provider's callback, not on a progress bar. Usually minutes, sometimes days.",
  },
  {
    title: `${BRAND.name} keeps a margin`,
    body: "The gap between what the advertiser pays and what you're paid. It runs the company.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="shell scroll-mt-20 py-[clamp(62px,8.5vw,116px)]">
      <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">
        Follow the money
      </span>
      <h2 className="mt-3 max-w-[20ch] text-[clamp(1.85rem,3.9vw,2.95rem)] font-semibold leading-[1.08] tracking-[-0.042em] text-balance">
        Outside money in. Your money out.
      </h2>
      <p className="mt-4 max-w-[54ch] text-[clamp(15px,1.55vw,17.5px)] font-light leading-[1.62] text-fg-2">
        Nothing here is funded by members, deposits, or token sales. The money enters at step one,
        and it comes from companies buying customers.
      </p>

      <ol className="mt-[clamp(32px,4vw,52px)] grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="surface-raised rounded-card p-[clamp(19px,2.3vw,26px)]">
            <span className="flex size-[29px] items-center justify-center rounded-lg bg-ac-dim text-[12.5px] font-semibold text-ac-2 shadow-[inset_0_0_0_1px_rgba(107,203,165,.26)]">
              {index + 1}
            </span>
            <h3 className="mt-[15px] text-[17px] font-semibold tracking-[-0.025em]">{step.title}</h3>
            <p className="mt-2 text-[13.5px] font-light leading-[1.65] text-fg-2">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
