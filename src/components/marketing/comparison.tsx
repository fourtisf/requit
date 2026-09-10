import { BRAND } from "@/lib/brand";

const ROWS = [
  ["Price on a game offer", "The unreachable maximum", "The tier people reach"],
  ["Completion rates", "Never shown", "Published per tier"],
  ["Purchase requirements", "In the fine print", "Flagged before you open it"],
  ["When an offer fails", "A support black hole", "A dispute with a status"],
  ["Withdrawal", "Gift cards and thresholds", "USD or ETH, from $10"],
] as const;

export function Comparison() {
  return (
    <section id="compare" className="shell scroll-mt-20 py-[clamp(62px,8.5vw,116px)]">
      <span className="text-[12.5px] font-semibold tracking-[0.015em] text-ac-2">
        The difference
      </span>
      <h2 className="mt-3 max-w-[18ch] text-[clamp(1.85rem,3.9vw,2.95rem)] font-semibold leading-[1.08] tracking-[-0.042em] text-balance">
        Two ways to run a reward site.
      </h2>

      <div className="mt-[clamp(28px,4vw,46px)] overflow-hidden rounded-card shadow-[inset_0_0_0_1px_var(--color-bd)]">
        <div className="hidden gap-px bg-bd sm:grid sm:grid-cols-[1.1fr_1fr_1fr]">
          {["", "Elsewhere", BRAND.name].map((heading, index) => (
            <div
              key={heading || index}
              className={
                index === 2
                  ? "bg-[rgba(255,255,255,.03)] px-[18px] py-[15px] text-[12.5px] font-semibold text-fg"
                  : "bg-[rgba(255,255,255,.03)] px-[18px] py-[15px] text-[12.5px] font-semibold text-fg-3"
              }
            >
              {heading}
            </div>
          ))}
        </div>

        {ROWS.map(([label, elsewhere, ours]) => (
          <div key={label} className="grid gap-px bg-bd sm:grid-cols-[1.1fr_1fr_1fr]">
            <div className="bg-bg-2 px-[18px] pb-1 pt-[15px] text-[13.5px] font-semibold text-fg sm:py-[15px] sm:font-normal sm:text-fg-3">
              {label}
            </div>
            <div className="bg-bg-2 px-[18px] py-1 text-[13.5px] text-fg-4 sm:py-[15px]">
              <span className="sm:hidden">Elsewhere — </span>
              {elsewhere}
            </div>
            <div className="bg-bg-2 px-[18px] pb-[15px] pt-1 text-[13.5px] font-medium text-fg sm:py-[15px]">
              <span className="text-ac-2 sm:hidden">{BRAND.name} — </span>
              {ours}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
