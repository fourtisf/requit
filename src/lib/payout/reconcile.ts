import { prisma } from "@/lib/prisma";
import { alert } from "@/lib/alert";
import { money } from "@/lib/format";
import type { Sender } from "@/lib/payout/execute";

/**
 * Finds payouts that were broadcast but never written down. §6.2.
 *
 * There is an unavoidable window in executeWithdrawal: the transaction is sent,
 * and then the hash is persisted. A process that dies in between has moved
 * money with no record of where. The row is already SENDING, so nothing retries
 * it — but nobody knows whether it landed either, and "we think we might have
 * paid you" is not an answer anyone can act on.
 *
 * This closes it from the other side: ask the chain what the hot wallet
 * actually sent, and match each outbound transfer against the rows that are
 * waiting for one.
 *
 * §6.2 asks for this in Phase 2 rather than later, and it is right to: the job
 * is only useful if it exists before the first time the window is hit.
 */

export type OutboundTransfer = {
  txHash: string;
  /** Recipient address, in the same canonical form Wallet.address stores. */
  to: string;
  /** Amount in USD, as a decimal string. */
  amountUsd: string;
  at: Date;
};

/**
 * A chain adapter that can look backwards. Kept separate from Sender because
 * only this job needs it, and because a fake is the only way to test the
 * matching logic.
 */
export type HistorySource = {
  chain: Sender["chain"];
  recentOutbound(since: Date): Promise<OutboundTransfer[]>;
};

export type ReconcileReport = {
  matched: number;
  unmatchedRows: string[];
  unmatchedTransfers: string[];
};

/** How far back to look. Longer than any plausible outage, short enough to stay cheap. */
const LOOKBACK_HOURS = 48;

export async function reconcile(
  source: HistorySource,
  now = new Date(),
): Promise<ReconcileReport> {
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3600_000);

  const orphans = await prisma.withdrawal.findMany({
    where: {
      chain: source.chain,
      status: "SENDING",
      txHash: null,
      requestedAt: { gte: since },
    },
    include: { wallet: { select: { address: true } } },
  });

  const transfers = await source.recentOutbound(since);

  // Hashes we already know about must not be matched to a second row — that is
  // how one transaction would be credited as two payouts.
  const known = new Set(
    (
      await prisma.withdrawal.findMany({
        where: { chain: source.chain, txHash: { not: null } },
        select: { txHash: true },
      })
    ).map((row) => row.txHash as string),
  );

  const available = transfers.filter((transfer) => !known.has(transfer.txHash));
  const report: ReconcileReport = { matched: 0, unmatchedRows: [], unmatchedTransfers: [] };
  const claimed = new Set<string>();

  for (const orphan of orphans) {
    const match = available.find(
      (transfer) =>
        !claimed.has(transfer.txHash) &&
        transfer.to === orphan.wallet.address &&
        transfer.amountUsd === orphan.amount.toFixed(2) &&
        transfer.at >= orphan.requestedAt,
    );

    if (!match) {
      report.unmatchedRows.push(orphan.id);
      continue;
    }

    claimed.add(match.txHash);
    await prisma.withdrawal.update({
      where: { id: orphan.id },
      data: { txHash: match.txHash },
    });
    report.matched += 1;
  }

  // An outbound transfer with no row behind it is money that left without a
  // withdrawal asking for it. That is the alarming direction, and it is never
  // resolved automatically.
  for (const transfer of available) {
    if (claimed.has(transfer.txHash)) continue;
    if (transfer.at < since) continue;
    report.unmatchedTransfers.push(transfer.txHash);
  }

  if (report.matched > 0) {
    await alert({
      severity: "warn",
      title: `Reconciled ${report.matched} ${source.chain} payout(s) that lost their hash`,
      detail: "Each was broadcast but not written down. They now have their transaction.",
      context: { chain: source.chain },
    });
  }

  if (report.unmatchedRows.length > 0) {
    await alert({
      severity: "critical",
      title: `${report.unmatchedRows.length} ${source.chain} payout(s) stuck with no transaction`,
      detail:
        "Marked SENDING but nothing on chain matches. Check manually before touching them — do not mark them failed without looking.",
      context: { chain: source.chain, withdrawals: report.unmatchedRows.join(",") },
    });
  }

  if (report.unmatchedTransfers.length > 0) {
    await alert({
      severity: "critical",
      title: `${report.unmatchedTransfers.length} outbound ${source.chain} transfer(s) with no withdrawal behind them`,
      detail: "Money left the hot wallet without a row asking for it. Investigate now.",
      context: { chain: source.chain, transactions: report.unmatchedTransfers.join(",") },
    });
  }

  return report;
}

/**
 * Warns before the hot wallet runs dry. §6.3: "A daily job alerts when the hot
 * wallet drops below two days of cover."
 */
export async function checkFloat(sender: Sender, now = new Date()): Promise<{
  balanceUsd: string;
  dailyAverageUsd: string;
  daysOfCover: number | null;
}> {
  const since = new Date(now.getTime() - 7 * 24 * 3600_000);
  const [balance, recent] = await Promise.all([
    sender.balanceUsd(),
    prisma.withdrawal.aggregate({
      where: { chain: sender.chain, status: "SETTLED", settledAt: { gte: since } },
      _sum: { amount: true },
    }),
  ]);

  const total = recent._sum.amount;
  const daily = total ? total.div(7) : null;

  // With no payout history there is no meaningful cover figure. Reporting
  // "infinite days" would be worse than reporting nothing.
  const daysOfCover = daily && !daily.isZero() ? Number(balance.div(daily).toFixed(2)) : null;

  if (daily && daysOfCover !== null && daysOfCover < 2) {
    await alert({
      severity: "critical",
      title: `${sender.chain} hot wallet has under two days of cover`,
      detail: `${money(balance)} against ${money(daily)}/day. Top it up from cold storage.`,
      context: { chain: sender.chain, daysOfCover: String(daysOfCover) },
    });
  }

  return {
    balanceUsd: balance.toFixed(2),
    dailyAverageUsd: daily ? daily.toFixed(2) : "0.00",
    daysOfCover,
  };
}
