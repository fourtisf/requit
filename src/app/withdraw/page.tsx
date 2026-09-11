import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { balanceOf } from "@/lib/balance";
import { AppNav } from "@/components/app-nav";
import { WalletBinder } from "@/components/wallet-binder";
import { WithdrawForm } from "@/components/withdraw-form";
import { Card, CardHeader } from "@/components/ui/card";
import { StatGrid, Stat } from "@/components/ui/stat";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { Chip, ChipRow } from "@/components/ui/chip";
import { MIN_WITHDRAWAL, releaseAt } from "@/lib/withdraw";
import { TIER_RULES } from "@/lib/risk";
import { money, relative, stamp } from "@/lib/format";
import { shortAddress } from "@/lib/wallet/address";

export const metadata = { title: "Withdraw" };
export const dynamic = "force-dynamic";

/** What each status means to the person waiting on it, not to the database. */
const EXPLAIN: Record<string, string> = {
  REQUESTED: "Queued.",
  HELD: "Inside the hold window for your tier.",
  APPROVED: "Released. Waiting for the next payout run.",
  SENDING: "Broadcast to the chain.",
  SETTLED: "Confirmed on chain.",
  FAILED: "Not sent. The amount went back to your balance.",
};

export default async function WithdrawPage() {
  const { id, riskTier } = await requireUser();
  const rule = TIER_RULES[riskTier];

  const [balance, wallets, history] = await Promise.all([
    balanceOf(id),
    prisma.wallet.findMany({ where: { userId: id }, orderBy: { id: "asc" } }),
    prisma.withdrawal.findMany({
      where: { userId: id },
      orderBy: { requestedAt: "desc" },
      take: 20,
      include: { wallet: { select: { address: true } } },
    }),
  ]);

  const verified = wallets.filter((wallet) => wallet.verifiedAt !== null);

  return (
    <main className="shell py-10">
      <AppNav current="/withdraw" />

      <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">Withdraw</h1>

      <StatGrid className="mt-7">
        <Stat value={money(balance.available)} label="available now" />
        <Stat value={money(balance.pending)} label="inside hold" />
        <Stat value={money(balance.paidOut)} label="paid to you to date" />
        <Stat value={rule.label} label="your tier" />
      </StatGrid>

      {balance.shortfall.isZero() ? null : (
        <p className="mt-3 rounded-soft bg-[rgba(232,198,139,.08)] px-[14px] py-3 text-[12.5px] leading-[1.55] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]">
          A network reversed {money(balance.shortfall)} of rewards after you had already been
          paid for them. You do not owe that back and your balance has not been reduced — but
          new withdrawals go to a person while we sort it out.
        </p>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Request a withdrawal" aside={rule.label} />
          <p className="mb-4 max-w-[54ch] text-[13px] leading-[1.6] text-fg-2">{rule.meaning}</p>
          <WithdrawForm
            wallets={verified.map((wallet) => ({
              id: wallet.id,
              chain: wallet.chain,
              address: wallet.address,
            }))}
            available={balance.available.toFixed(2)}
            minimum={MIN_WITHDRAWAL.toFixed(2)}
          />
        </Card>

        <Card>
          <CardHeader title="Wallets" aside={`${verified.length} verified`} />
          {wallets.length > 0 ? (
            <ul className="mb-5 text-[13px]">
              {wallets.map((wallet) => (
                <li
                  key={wallet.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-bd py-2.5"
                >
                  <span className="mn text-fg-2">
                    {wallet.chain === "BASE" ? "Base" : "Solana"} ·{" "}
                    {shortAddress(wallet.address)}
                  </span>
                  <span
                    className={
                      wallet.verifiedAt ? "text-[12px] text-ac-2" : "text-[12px] text-amber"
                    }
                  >
                    {wallet.verifiedAt ? "verified" : "unverified"}
                    {wallet.isPayout ? " · default" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <WalletBinder />
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader title="Your withdrawals" aside="most recent 20" />
        {history.length === 0 ? (
          <p className="text-[13px] text-fg-3">None yet.</p>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Requested</Th>
                <Th>Amount</Th>
                <Th>To</Th>
                <Th>State</Th>
                <Th>Transaction</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => {
                const release = row.status === "HELD" ? releaseAt(riskTier, row.requestedAt) : null;
                return (
                  <tr key={row.id}>
                    <Td className="mn text-fg-3">{stamp(row.requestedAt)}</Td>
                    <Td className="mn">{money(row.amount)}</Td>
                    <Td className="mn text-fg-3">{shortAddress(row.wallet.address)}</Td>
                    <Td className={row.status === "FAILED" ? "text-amber" : undefined}>
                      {EXPLAIN[row.status] ?? row.status}
                      {release ? ` Releases ${relative(release)}.` : ""}
                      {row.failureReason ? ` ${row.failureReason}` : ""}
                    </Td>
                    <Td className="mn text-fg-4">
                      {row.txHash ? `${row.txHash.slice(0, 10)}…` : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableScroll>
        )}

        <ChipRow>
          <Chip>Minimum {money(MIN_WITHDRAWAL)}</Chip>
          <Chip>Solana pays USDC</Chip>
          <Chip>Base pays ETH</Chip>
          <Chip>Network fee is ours</Chip>
        </ChipRow>
      </Card>
    </main>
  );
}
