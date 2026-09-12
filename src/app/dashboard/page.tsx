import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { ReadinessCard } from "@/components/readiness-card";
import { StatGrid, Stat } from "@/components/ui/stat";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import { TIER_LADDER, TIER_RULES, holdDescription, isLadderTier } from "@/lib/risk";
import { balanceOf } from "@/lib/balance";
import { offersFor } from "@/lib/offers";
import { money } from "@/lib/format";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

/**
 * The money tiles are summed from rows on every request — §6.1's "never trust a
 * cached balance". The task count comes from the same query /tasks renders, so
 * the two cannot disagree about what is available.
 */
export default async function DashboardPage() {
  const { id, handle, countryCode, riskTier } = await requireUser();
  const countryKnown = countryCode !== UNKNOWN_COUNTRY;
  const rule = TIER_RULES[riskTier];

  const [balance, offers] = await Promise.all([
    balanceOf(id),
    offersFor({ countryCode }),
  ]);

  return (
    <main className="shell py-10">
      <AppNav current="/dashboard" />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">{handle}</h1>
        <span className="mn text-[12.5px] text-fg-4">{countryKnown ? countryCode : "country unknown"}</span>
      </div>

      <StatGrid className="mt-7">
        <Stat value={money(balance.available)} label="available to withdraw" />
        <Stat value={money(balance.pending)} label="pending confirmation" />
        <Stat value={money(balance.paidOut)} label="paid to you to date" />
        <Stat value={String(offers.length)} label="tasks available" />
      </StatGrid>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <ReadinessCard userId={id} />

        <Card>
          <CardHeader
            title="Tasks"
            aside={offers.length > 0 ? `${offers.length} for ${countryCode}` : undefined}
          />
          {offers.length > 0 ? (
            <>
              <p className="max-w-[62ch] text-[13.5px] font-light leading-[1.65] text-fg-2">
                Reward, eligibility, deadline and any purchase requirement are shown before you
                start — never after.
              </p>
              <ButtonLink href="/tasks" className="mt-5">
                Browse tasks
              </ButtonLink>
            </>
          ) : (
            <p className="max-w-[62ch] text-[13.5px] font-light leading-[1.65] text-fg-2">
              There are no tasks matched to {countryKnown ? countryCode : "your country"} right
              now. We would rather show you nothing than a task that cannot pay out.
            </p>
          )}
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
