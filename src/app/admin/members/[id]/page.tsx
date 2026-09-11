import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { prisma } from "@/lib/prisma";
import { balanceOf } from "@/lib/balance";
import { AdminNav } from "@/components/admin-nav";
import { AdminForm } from "@/components/admin-form";
import {
  reinstateAction,
  setTierAction,
  suspendAction,
} from "@/app/admin/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { StatGrid, Stat } from "@/components/ui/stat";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { Chip, ChipRow } from "@/components/ui/chip";
import { TIER_RULES } from "@/lib/risk";
import { money, relative, stamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.user.findUnique({ where: { id }, select: { handle: true } });
  return { title: member ? `${member.handle} · Operator` : "Member · Operator" };
}

export default async function AdminMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const member = await prisma.user.findUnique({
    where: { id },
    include: {
      wallets: { orderBy: { id: "asc" } },
      devices: { orderBy: { lastSeenAt: "desc" }, take: 10 },
      referredBy: { select: { id: true, handle: true } },
      _count: { select: { referrals: true } },
    },
  });
  if (!member) notFound();

  const [balance, rewards, withdrawals, sharedDevice] = await Promise.all([
    balanceOf(member.id),
    prisma.reward.findMany({
      where: { userId: member.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.withdrawal.findMany({
      where: { userId: member.id },
      orderBy: { requestedAt: "desc" },
      take: 25,
      include: { wallet: { select: { chain: true, address: true } } },
    }),
    // §7's cheapest multi-account signal: another account seen on the same
    // device fingerprint. Not proof — shared phones and cafés exist — so it is
    // surfaced as something to look at, never acted on automatically.
    prisma.device.findMany({
      where: {
        userId: { not: member.id },
        fingerprint: { in: member.devices.map((device) => device.fingerprint) },
      },
      select: { userId: true, fingerprint: true },
      take: 10,
    }),
  ]);

  // Audit rows are keyed by the row they changed, so a withdrawal decision is
  // filed under the withdrawal id. An operator reading a member's history wants
  // both — "we rejected their payout twice" is the history, not a separate one.
  const actions = await prisma.adminAction.findMany({
    where: { subjectId: { in: [member.id, ...withdrawals.map((row) => row.id)] } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const rule = TIER_RULES[member.riskTier];

  return (
    <main className="shell py-10">
      <AdminNav current="/admin/members" />

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">{member.handle}</h1>
        <span className="mn text-[12.5px] text-fg-4">{member.email}</span>
        <span className="mn text-[12.5px] text-fg-4">{member.countryCode}</span>
      </div>

      <ChipRow>
        <Chip>{rule.label}</Chip>
        <Chip>Joined {stamp(member.createdAt)}</Chip>
        {member.suspendedAt ? <Chip tone="amber">Suspended</Chip> : null}
        {sharedDevice.length > 0 ? (
          <Chip tone="amber">
            Device shared with {new Set(sharedDevice.map((d) => d.userId)).size} other account(s)
          </Chip>
        ) : null}
        {member.referredBy ? <Chip>Referred by {member.referredBy.handle}</Chip> : null}
        {member._count.referrals > 0 ? (
          <Chip>{member._count.referrals} referrals</Chip>
        ) : null}
      </ChipRow>

      {member.suspendedAt ? (
        <p className="mt-5 rounded-soft bg-[rgba(232,198,139,.08)] px-[14px] py-3 text-[13px] leading-[1.55] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]">
          Suspended {relative(member.suspendedAt)} — “{member.suspendReason}”. This is the exact
          text the member is shown on /suspended.
        </p>
      ) : null}

      <StatGrid className="mt-6">
        <Stat value={money(balance.available)} label="withdrawable" />
        <Stat value={money(balance.pending)} label="inside hold" />
        <Stat value={money(balance.paidOut)} label="paid to date" />
        <Stat value={money(balance.shortfall)} label="reversed after payout" />
      </StatGrid>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account state" aside={rule.label} />
          <p className="max-w-[56ch] text-[13px] leading-[1.6] text-fg-2">{rule.meaning}</p>

          <AdminForm
            action={setTierAction}
            hidden={{ userId: member.id }}
            label="Move to another tier"
            verb="Change tier"
          >
            <select
              name="tier"
              defaultValue={member.riskTier}
              className="mt-2 w-full rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none"
            >
              {Object.values(TIER_RULES).map((tier) => (
                <option key={tier.tier} value={tier.tier}>
                  {tier.label} — {tier.holdHours === null ? "no hold" : `${tier.holdHours}h hold`}
                </option>
              ))}
            </select>
          </AdminForm>

          <div className="mt-5 border-t border-bd pt-5">
            {member.suspendedAt ? (
              <AdminForm
                action={reinstateAction}
                hidden={{ userId: member.id }}
                label="Lift the suspension"
                verb="Reinstate"
              />
            ) : (
              <AdminForm
                action={suspendAction}
                hidden={{ userId: member.id }}
                label="Suspend — they are shown this reason, and can appeal"
                verb="Suspend"
                destructive
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Wallets" aside={`${member.wallets.length}`} />
          {member.wallets.length === 0 ? (
            <p className="text-[13px] text-fg-3">No wallet bound yet.</p>
          ) : (
            <ul className="text-[13px]">
              {member.wallets.map((wallet) => (
                <li
                  key={wallet.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-bd py-2.5 last:border-b-0"
                >
                  <span className="mn text-fg-2">
                    {wallet.chain} · {wallet.address}
                  </span>
                  <span className={wallet.verifiedAt ? "text-[12px] text-ac-2" : "text-[12px] text-amber"}>
                    {wallet.verifiedAt ? "verified" : "unverified"}
                    {wallet.isPayout ? " · payout" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <CardHeader title="Devices" aside={`${member.devices.length}`} />
          {member.devices.length === 0 ? (
            <p className="text-[13px] text-fg-3">None recorded.</p>
          ) : (
            <ul className="text-[12.5px]">
              {member.devices.map((device) => {
                const shared = sharedDevice.some((d) => d.fingerprint === device.fingerprint);
                return (
                  <li
                    key={device.id}
                    className="flex items-center justify-between gap-2 border-b border-bd py-2 last:border-b-0"
                  >
                    <span className="mn text-fg-3">{device.fingerprint.slice(0, 16)}…</span>
                    <span className={shared ? "text-amber" : "text-fg-4"}>
                      {shared ? "shared" : "seen"} {relative(device.lastSeenAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader title="Withdrawals" aside="most recent 25" />
        {withdrawals.length === 0 ? (
          <p className="text-[13px] text-fg-3">None.</p>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Requested</Th>
                <Th>Amount</Th>
                <Th>Chain</Th>
                <Th>Status</Th>
                <Th>Tx</Th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((row) => (
                <tr key={row.id}>
                  <Td className="mn text-fg-3">{stamp(row.requestedAt)}</Td>
                  <Td className="mn">{money(row.amount)}</Td>
                  <Td>{row.wallet.chain}</Td>
                  <Td className={row.status === "FAILED" ? "text-amber" : undefined}>
                    {row.status}
                    {row.failureReason ? ` — ${row.failureReason}` : ""}
                  </Td>
                  <Td className="mn text-fg-4">{row.txHash ? `${row.txHash.slice(0, 10)}…` : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>

      <Card className="mt-3">
        <CardHeader title="Rewards" aside="most recent 25" />
        {rewards.length === 0 ? (
          <p className="text-[13px] text-fg-3">None.</p>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Credited</Th>
                <Th>Network</Th>
                <Th>Paid to member</Th>
                <Th>Advertiser paid</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((row) => (
                <tr key={row.id}>
                  <Td className="mn text-fg-3">{stamp(row.createdAt)}</Td>
                  <Td>{row.network}</Td>
                  <Td className="mn">{money(row.amount)}</Td>
                  <Td className="mn text-fg-3">{money(row.advertiserPaid)}</Td>
                  <Td className={row.status === "REVERSED" ? "text-amber" : undefined}>
                    {row.status}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>

      <Card className="mt-3">
        <CardHeader title="Operator history" aside="every manual change" />
        {actions.length === 0 ? (
          <p className="text-[13px] text-fg-3">Nobody has touched this account by hand.</p>
        ) : (
          <ul className="text-[13px]">
            {actions.map((entry) => (
              <li key={entry.id} className="border-b border-bd py-2.5 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="mn text-fg">{entry.action}</span>
                  <span className="mn text-[12px] text-fg-4">{entry.actorEmail}</span>
                  <span className="mn ml-auto text-[12px] text-fg-4">
                    {stamp(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-fg-3">{entry.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
