import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { emailTransportConfigured } from "@/lib/auth/email";
import { AdminForm } from "@/components/admin-form";
import { testMailAction } from "@/app/admin/actions";
import { demandByCountry } from "@/lib/interest";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { liability, treasury } from "@/lib/admin/treasury";
import { AdminNav } from "@/components/admin-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { StatGrid, Stat } from "@/components/ui/stat";
import { money } from "@/lib/format";

export const metadata = { title: "Operator" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [figures, demand] = await Promise.all([treasury(), demandByCountry()]);
  const owed = liability(figures);
  const covered = figures.receivable.sub(owed);

  return (
    <main className="shell py-10">
      <AdminNav current="/admin" />

      <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">Treasury</h1>
      <p className="mt-2 max-w-[64ch] text-[13.5px] leading-[1.65] text-fg-2">
        Every figure is summed from rows at request time. Nothing here is cached, because a
        stale number on this page is the one that decides to keep paying out when we cannot.
      </p>

      <StatGrid className="mt-7">
        <Stat value={money(figures.owedNow)} label="withdrawable now" />
        <Stat value={money(figures.owedSoon)} label="inside hold window" />
        <Stat value={money(figures.inFlight)} label="withdrawals in flight" />
        <Stat value={money(figures.receivable)} label="invoiced, unpaid" />
      </StatGrid>

      <Card className="mt-3">
        <CardHeader
          title="Where people are waiting"
          aside={demand.length > 0 ? `${demand.length} ${demand.length === 1 ? "country" : "countries"}` : "nobody yet"}
        />
        {demand.length === 0 ? (
          <p className="max-w-[60ch] text-[13px] leading-[1.6] text-fg-3">
            Nobody has asked to be told when tasks open in their country. The button that records
            this only appears on an empty task list, so this stays empty until somebody signs up
            somewhere we have no inventory.
          </p>
        ) : (
          <>
            <TableScroll>
              <thead>
                <tr>
                  <Th>Country</Th>
                  <Th>Waiting</Th>
                  <Th>Already told</Th>
                </tr>
              </thead>
              <tbody>
                {demand.map((row) => (
                  <tr key={row.countryCode}>
                    <Td className="mn">{row.countryCode}</Td>
                    <Td className="mn">{row.waiting}</Td>
                    <Td className="mn text-fg-3">{row.notified}</Td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
            <p className="mt-4 max-w-[66ch] text-[12px] leading-[1.55] text-fg-4">
              This is the evidence a network asks for before approving a publisher. It is a count
              of real accounts that asked, not of visits.
            </p>
          </>
        )}
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Can we pay what we owe?" />
          <dl className="text-[13.5px]">
            <Row label="Owed to members, total" value={money(owed)} />
            <Row label="Receivable from networks" value={money(figures.receivable)} />
            <Row
              label={covered.isNegative() ? "Short by" : "Covered by"}
              value={money(covered.abs())}
              tone={covered.isNegative() ? "amber" : "ok"}
            />
          </dl>
          <p className="mt-4 max-w-[58ch] text-[12.5px] leading-[1.6] text-fg-3">
            Receivable is what networks have been invoiced and have not paid. It is not cash on
            hand — the float that bridges the gap between paying members and being paid is
            tracked outside this app, and this page cannot see it.
          </p>
          {figures.writtenOff.isZero() ? null : (
            <p className="mt-3 rounded-soft bg-[rgba(232,198,139,.08)] px-[14px] py-3 text-[12.5px] leading-[1.5] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]">
              {money(figures.writtenOff)} of rewards were reversed by a network after they had
              been confirmed. Members were not charged for it.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Sign-in email"
            aside={emailTransportConfigured() ? "configured" : "not usable"}
          />
          <p className="max-w-[54ch] text-[13px] leading-[1.6] text-fg-2">
            {emailTransportConfigured()
              ? "The connection string is well formed. That does not prove the password is right — run the test."
              : "EMAIL_SERVER is missing or malformed, so nobody can sign in. The test below says exactly which part is wrong."}
          </p>
          <AdminForm
            action={testMailAction}
            hidden={{}}
            label="Opens a connection and authenticates. Sends nothing."
            verb="Test the connection"
            withReason={false}
          />
        </Card>

        <Card>
          <CardHeader title="Queues" aside="needs a person" />
          <ul className="text-[13.5px]">
            <QueueRow
              href="/admin/withdrawals"
              label="Withdrawals held for review"
              count={figures.queues.held}
            />
            <QueueRow
              href="/admin/withdrawals"
              label="Withdrawals requested"
              count={figures.queues.requested}
            />
            <QueueRow
              href="/admin/members"
              label="Members flagged"
              count={figures.queues.flagged}
            />
            <QueueRow href="/admin/disputes" label="Disputes open" count={figures.queues.disputes} />
          </ul>
        </Card>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "amber" | "ok";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-bd py-2.5 last:border-b-0">
      <dt className="text-fg-3">{label}</dt>
      <dd
        className={
          tone === "amber" ? "mn text-amber" : tone === "ok" ? "mn text-ac-2" : "mn text-fg"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function QueueRow({ href, label, count }: { href: "/admin/withdrawals" | "/admin/members" | "/admin/disputes"; label: string; count: number }) {
  return (
    <li className="flex items-center justify-between gap-4 border-b border-bd py-2.5 last:border-b-0">
      <Link href={href} className="text-fg-2 transition-colors hover:text-fg">
        {label}
      </Link>
      <span className={count > 0 ? "mn text-amber" : "mn text-fg-4"}>{count}</span>
    </li>
  );
}
