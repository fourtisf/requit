import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { BrandLockup } from "@/components/ui/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardHeader } from "@/components/ui/card";
import { StatGrid, Stat } from "@/components/ui/stat";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { OkDot } from "@/components/ui/badge";
import { CountryChecker } from "@/components/country-checker";
import { publicStats, recentPayouts, sla } from "@/lib/public-stats";

export const metadata = {
  title: "Proof",
  description: "Every payout, every dispute response time, computed from our own records.",
};
export const dynamic = "force-dynamic";

const EXPLORER: Record<string, string> = {
  SOLANA: "https://solscan.io/tx/",
  BASE: "https://basescan.org/tx/",
};

/**
 * The page the rest of the marketing rests on. §8.
 *
 * Every figure here is read from rows at request time.
 *
 * Two different absences, kept distinct: a total that is genuinely zero is
 * shown as zero, because "nobody has been paid yet" is a fact and stating it
 * is the point of the page. A figure that cannot be computed — a median over
 * no disputes, a completion rate over four samples — says so in words. §8
 * reserves null for the second case, and collapsing them would let the page
 * hide a true zero behind an ambiguity.
 */
export default async function ProofPage() {
  const [stats, response, payouts] = await Promise.all([publicStats(), sla(), recentPayouts()]);

  return (
    <>
      <main className="shell py-10">
        <header className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-bd pb-4">
          <BrandLockup href="/" />
          <nav className="flex flex-1 flex-wrap items-center gap-4 text-[13.5px] text-fg-3">
            <Link href="/" className="transition-colors hover:text-fg">
              Home
            </Link>
            <Link href="/reward-policy" className="transition-colors hover:text-fg">
              Reward policy
            </Link>
            <Link href="/leaderboard" className="transition-colors hover:text-fg">
              Leaderboard
            </Link>
            <Link
              href="/signin"
              className="ml-auto rounded-lg bg-surf-2 px-[15px] py-[7px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:bg-surf-3"
            >
              Sign in
            </Link>
          </nav>
        </header>

        <h1 className="text-[clamp(30px,4.6vw,44px)] font-semibold leading-[1.05] tracking-[-0.04em]">
          Proof.
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] font-light leading-[1.65] text-fg-2">
          Everything below is computed from our own records when you load this page. Nothing here
          is typed in by hand. Where a figure is zero it says zero, and where there is not yet
          enough history to compute one it says that instead of guessing.
        </p>

        {/* All four are shown as figures even when they are zero. §8 reserves
            null for a number that CANNOT be computed, and "nobody has been paid
            yet" is not that — it is a fact, and $0.00 states it while an em dash
            hides it behind an ambiguity. On a page whose whole purpose is not
            flattering ourselves, that distinction is the page. */}
        <StatGrid className="mt-8">
          <Stat value={`$${stats.paidToDate}`} label="paid to members, all time" />
          <Stat value={`$${stats.paidLast7d}`} label="paid in the last 7 days" />
          <Stat value={String(stats.withdrawalCount)} label="withdrawals settled" />
          <Stat value={String(stats.refusedCount)} label="withdrawals we refused" />
        </StatGrid>

        <p className="mt-3 text-[12.5px] leading-[1.55] text-fg-4">
          “Refused” counts withdrawals {BRAND.name} declined — our decision, not a chain error. It
          is a real count. If it stops being zero, this number goes up.
        </p>

        <Card className="mt-3">
          <CardHeader title="Recent payouts" aside="last 12 settled" />
          {payouts.length === 0 ? (
            <p className="max-w-[60ch] text-[13.5px] leading-[1.6] text-fg-3">
              No withdrawal has settled yet. When one does it appears here within the minute, with
              a transaction hash you can open on a block explorer and check against the chain
              without taking our word for it.
            </p>
          ) : (
            <TableScroll>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Member</Th>
                  <Th>Chain</Th>
                  <Th>Amount</Th>
                  <Th>Transaction</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.txHash}>
                    <Td className="mn text-fg-3">{payout.date}</Td>
                    <Td>{payout.handle ?? <span className="text-fg-4">private</span>}</Td>
                    <Td>{payout.chain}</Td>
                    <Td className="mn">${payout.amount}</Td>
                    <Td>
                      <a
                        href={`${EXPLORER[payout.chain] ?? ""}${payout.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mn text-ac-2 hover:underline"
                      >
                        <OkDot>{payout.txHash.slice(0, 10)}…</OkDot>
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          )}
          <p className="mt-4 text-[12px] leading-[1.55] text-fg-4">
            A member who turns off public payouts in their settings appears as “private”. The
            amount and the transaction stay — the name is theirs to withhold, the payment is not.
          </p>
        </Card>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Dispute response times"
              aside={response.sampleSize > 0 ? `${response.sampleSize} in 90 days` : "no data yet"}
            />
            {response.sampleSize === 0 ? (
              <p className="max-w-[54ch] text-[13.5px] leading-[1.6] text-fg-3">
                Nobody has opened a dispute yet, so there is nothing to average. These are the
                figures we will publish, whatever they turn out to be — they are computed from the
                timestamps on real disputes, not from a target we set.
              </p>
            ) : (
              <dl className="text-[13.5px]">
                <Row
                  label="Median time to a first human reply"
                  value={response.firstReplyHours === null ? null : `${response.firstReplyHours}h`}
                />
                <Row
                  label="Median time to escalation"
                  value={
                    response.escalationHours === null ? null : `${response.escalationHours}h`
                  }
                />
                <Row
                  label="Median time to resolution"
                  value={
                    response.medianResolutionDays === null
                      ? null
                      : `${response.medianResolutionDays} days`
                  }
                />
                <Row
                  label="Disputes resolved in your favour"
                  value={
                    response.paidRate === null
                      ? null
                      : `${Math.round(response.paidRate * 100)}%`
                  }
                />
              </dl>
            )}
            <p className="mt-4 text-[12px] leading-[1.55] text-fg-4">
              Medians, not averages. One dispute that sat for a month would drag an average into
              uselessness while the typical experience stayed the same.
            </p>
          </Card>

          <Card>
            <CardHeader title="What you can expect where you are" />
            <CountryChecker />
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-bd py-2.5 last:border-b-0">
      <dt className="text-fg-3">{label}</dt>
      <dd className={value === null ? "mn text-fg-4" : "mn text-fg"}>{value ?? "not enough data"}</dd>
    </div>
  );
}
