import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { prisma } from "@/lib/prisma";
import { balanceOf } from "@/lib/balance";
import { AdminNav } from "@/components/admin-nav";
import { AdminForm } from "@/components/admin-form";
import { approveWithdrawalAction, rejectWithdrawalAction } from "@/app/admin/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip, ChipRow } from "@/components/ui/chip";
import { money, relative, stamp } from "@/lib/format";
import { TIER_RULES } from "@/lib/risk";

export const metadata = { title: "Withdrawals · Operator" };
export const dynamic = "force-dynamic";

/** Everything a person has to decide on. SETTLED and FAILED are history. */
const REVIEWABLE = ["REQUESTED", "HELD"] as const;

export default async function AdminWithdrawalsPage() {
  await requireAdmin();

  const queue = await prisma.withdrawal.findMany({
    where: { status: { in: [...REVIEWABLE] } },
    orderBy: { requestedAt: "asc" }, // oldest first: nobody waits twice
    take: 100,
    include: {
      user: {
        select: { id: true, handle: true, email: true, riskTier: true, countryCode: true, createdAt: true },
      },
      wallet: { select: { chain: true, address: true, verifiedAt: true } },
    },
  });

  // One balance read per member in the queue, not per row.
  const memberIds = [...new Set(queue.map((row) => row.userId))];
  const balances = new Map(
    await Promise.all(
      memberIds.map(async (id) => [id, await balanceOf(id)] as const),
    ),
  );

  return (
    <main className="shell py-10">
      <AdminNav current="/admin/withdrawals" />

      <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">Withdrawals</h1>
      <p className="mt-2 max-w-[68ch] text-[13.5px] leading-[1.65] text-fg-2">
        Oldest first. Approving does not broadcast anything — it moves the row to APPROVED and
        the payout worker sends it, so one place signs transactions and it is not this page.
      </p>

      {queue.length === 0 ? (
        <Card className="mt-7">
          <p className="text-[13.5px] text-fg-3">Nothing waiting on a person.</p>
        </Card>
      ) : (
        <div className="mt-7 grid gap-3">
          {queue.map((row) => {
            const balance = balances.get(row.userId);
            const unverified = row.wallet.verifiedAt === null;
            // balanceOf() already counts this withdrawal as committed, so a
            // shortfall here means the member was paid for a reward a network
            // later took back — not that this request is too large.
            const short = balance && !balance.shortfall.isZero();

            return (
              <Card key={row.id}>
                <CardHeader
                  title={
                    <>
                      <span className="mn">{money(row.amount)}</span>{" "}
                      <span className="text-fg-3">to</span>{" "}
                      <Link
                        href={`/admin/members/${row.userId}`}
                        className="text-ac-2 hover:underline"
                      >
                        {row.user.handle}
                      </Link>
                    </>
                  }
                  aside={`${row.status} · requested ${relative(row.requestedAt)}`}
                />

                <dl className="grid gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2">
                  <Field label="Chain" value={`${row.chain} · ${truncate(row.wallet.address)}`} />
                  <Field label="Tier" value={TIER_RULES[row.user.riskTier].label} />
                  <Field label="Country" value={row.user.countryCode} />
                  <Field label="Member since" value={stamp(row.user.createdAt)} />
                  <Field
                    label="Balance after this"
                    value={balance ? money(balance.available) : "—"}
                  />
                  <Field label="Requested at" value={stamp(row.requestedAt)} />
                </dl>

                <ChipRow>
                  {unverified ? <Chip tone="amber">Wallet never verified</Chip> : null}
                  {row.user.riskTier === "FLAGGED" ? <Chip tone="amber">Member flagged</Chip> : null}
                  {short ? (
                    <Chip tone="amber">
                      Short {money(balance.shortfall)} after a reversal
                    </Chip>
                  ) : null}
                  {!unverified && !short && row.user.riskTier !== "FLAGGED" ? (
                    <Chip>Nothing unusual</Chip>
                  ) : null}
                </ChipRow>

                <div className="mt-5 grid gap-5 border-t border-bd pt-5 sm:grid-cols-2">
                  <AdminForm
                    action={approveWithdrawalAction}
                    hidden={{ withdrawalId: row.id }}
                    label="Approve for sending"
                    verb="Approve"
                  />
                  <AdminForm
                    action={rejectWithdrawalAction}
                    hidden={{ withdrawalId: row.id }}
                    label="Reject — the amount returns to their balance"
                    verb="Reject"
                    destructive
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-bd py-1.5">
      <dt className="text-fg-4">{label}</dt>
      <dd className="mn text-right text-fg-2">{value}</dd>
    </div>
  );
}

function truncate(address: string): string {
  return address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
