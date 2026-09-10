import { requireUser } from "@/lib/session";
import { BRAND } from "@/lib/brand";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { StatGrid, Stat } from "@/components/ui/stat";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import { TIER_LADDER, TIER_RULES, holdDescription, isLadderTier } from "@/lib/risk";

export const metadata = { title: "Dashboard" };

/**
 * Every figure is null on purpose. Tasks arrive in Phase 1, balances in Phase 2 —
 * until the queries behind them exist, the tiles show an em dash rather than a
 * zero that looks computed.
 */
export default async function DashboardPage() {
  const { handle, countryCode, riskTier } = await requireUser();
  const countryKnown = countryCode !== UNKNOWN_COUNTRY;
  const rule = TIER_RULES[riskTier];

  return (
    <main className="shell py-10">
      <AppNav current="/dashboard" />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">{handle}</h1>
        <span className="mn text-[12.5px] text-fg-4">{countryKnown ? countryCode : "country unknown"}</span>
      </div>

      <StatGrid className="mt-7">
        <Stat value={null} label="available to withdraw" />
        <Stat value={null} label="pending confirmation" />
        <Stat value={null} label="paid to you to date" />
        <Stat value={null} label="tasks available" />
      </StatGrid>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tasks" aside="Phase 1" />
          <p className="max-w-[62ch] text-[13.5px] font-light leading-[1.65] text-fg-2">
            {BRAND.name} has no live offer inventory yet. Reward, eligibility, deadline and any
            purchase requirement will be shown here before you start a task — never after.
          </p>
          {!countryKnown ? (
            <p className="mt-4 rounded-soft bg-[rgba(232,198,139,.08)] px-[14px] py-3 text-[12.5px] leading-[1.5] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]">
              We could not determine your country at sign-up, and offers are matched by country.
              Set it in settings before your first task.
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Withdrawal speed" aside={rule.label} />
          <p className="max-w-[58ch] text-[13.5px] leading-[1.6] text-fg-2">{rule.meaning}</p>

          {isLadderTier(riskTier) ? (
            <ol className="mt-5">
              {TIER_LADDER.map((tier) => {
                const reached = TIER_LADDER.indexOf(tier) <= TIER_LADDER.indexOf(riskTier);
                return (
                  <li
                    key={tier}
                    className="flex items-center gap-3 border-b border-bd py-2.5 last:border-b-0"
                  >
                    <span
                      className={
                        reached
                          ? "size-[7px] shrink-0 rounded-full bg-ac shadow-[0_0_9px_var(--color-ac)]"
                          : "size-[7px] shrink-0 rounded-full bg-surf-3"
                      }
                    />
                    <span className={reached ? "text-[13px] text-fg" : "text-[13px] text-fg-4"}>
                      {TIER_RULES[tier].label}
                    </span>
                    <span className="mn ml-auto text-[12px] text-fg-3">
                      {holdDescription(tier)}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : null}

          <p className="mt-4 text-[12px] leading-[1.55] text-fg-4">
            You move up by completing tasks that the network confirms and that stay confirmed.
            There is nothing to buy and nothing to apply for.
          </p>
        </Card>
      </div>
    </main>
  );
}
