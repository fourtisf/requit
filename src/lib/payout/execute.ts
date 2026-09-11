import { Prisma, type Chain, type Withdrawal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { alert } from "@/lib/alert";
import { notify } from "@/lib/notify";
import { money } from "@/lib/format";

/**
 * What a chain adapter has to provide. Kept narrow on purpose: the state
 * machine below is the part that must be right, and it is only testable
 * without a chain if the chain is behind an interface this small.
 */
export type Sender = {
  chain: Chain;
  /** Broadcasts and returns the hash. Must not wait for confirmation. */
  send(args: { to: string; amountUsd: Prisma.Decimal }): Promise<{ txHash: string }>;
  confirm(txHash: string): Promise<TxState>;
  /** Hot wallet balance, in USD, for the float alarm. */
  balanceUsd(): Promise<Prisma.Decimal>;
};

export type TxState = "confirmed" | "pending" | "failed";

export type ExecuteOutcome =
  | { kind: "sent"; txHash: string }
  | { kind: "skipped"; why: SkipReason }
  | { kind: "failed"; why: string }
  | { kind: "needs-review"; why: string };

export type SkipReason =
  | "not-approved"
  | "over-per-payout-cap"
  | "over-daily-cap"
  | "insufficient-float"
  | "wallet-unverified";

/**
 * Caps. Not in the handoff; added because §6.3 puts a working float in a hot
 * wallet, and the whole point of a working float is that a compromised process
 * or a logic bug cannot take more than a bounded amount before someone notices.
 * Without a cap, "hot wallet holds three days of payouts" describes the maximum
 * single loss rather than a limit on it.
 */
export const PER_PAYOUT_CAP = new Prisma.Decimal("500");
export const DAILY_CAP = new Prisma.Decimal("5000");

const ZERO = new Prisma.Decimal(0);

/**
 * Sends one approved withdrawal. §6.2.
 *
 * The ordering is the whole thing:
 *
 *   1. Claim the row by moving APPROVED -> SENDING conditionally, so two
 *      workers cannot both broadcast the same payout.
 *   2. Broadcast.
 *   3. Persist the hash immediately.
 *
 * Between 2 and 3 there is a window where the process can die having sent money
 * we have no record of. It cannot be closed — the chain and our database are
 * two systems — so it is made recoverable instead: the row is already SENDING,
 * and reconcile() finds the transaction by scanning the hot wallet's outbound
 * history. §6.2 asks for that job in Phase 2, not later, and it is in
 * reconcile.ts.
 */
export async function executeWithdrawal(
  withdrawalId: string,
  sender: Sender,
): Promise<ExecuteOutcome> {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { wallet: { select: { address: true, verifiedAt: true } } },
  });
  if (!withdrawal) return { kind: "skipped", why: "not-approved" };
  if (withdrawal.status !== "APPROVED") return { kind: "skipped", why: "not-approved" };

  // Re-checked here rather than trusted from request time: a wallet can be
  // unverified between approval and sending only by an operator, but if that
  // happened it was deliberate.
  if (withdrawal.wallet.verifiedAt === null) {
    return { kind: "skipped", why: "wallet-unverified" };
  }

  const refusal = await checkCaps(withdrawal, sender);
  if (refusal) {
    await alert({
      severity: "critical",
      title: `Payout held: ${refusal}`,
      detail: `${money(withdrawal.amount)} to ${withdrawal.wallet.address} on ${withdrawal.chain}.`,
      context: { withdrawal: withdrawal.id, reason: refusal },
    });
    return { kind: "skipped", why: refusal };
  }

  // Step 1. updateMany with the expected status in the filter is the claim:
  // exactly one worker gets count === 1.
  const { count } = await prisma.withdrawal.updateMany({
    where: { id: withdrawal.id, status: "APPROVED" },
    data: { status: "SENDING" },
  });
  if (count === 0) return { kind: "skipped", why: "not-approved" };

  let txHash: string;
  try {
    // Step 2.
    txHash = (await sender.send({
      to: withdrawal.wallet.address,
      amountUsd: withdrawal.amount,
    })).txHash;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";

    // A throw here is ambiguous: the broadcast may have landed anyway. The row
    // stays SENDING and goes to a person — §6.2: "Never retry a SENDING row
    // automatically." Marking it FAILED would return the amount to the balance
    // and let it be spent a second time.
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { failureReason: `Broadcast failed: ${message}. Needs manual check.` },
    });
    await alert({
      severity: "critical",
      title: `Broadcast threw for ${withdrawal.chain} payout`,
      detail: `${message}. The row is SENDING and will not retry. Check the chain before touching it.`,
      context: { withdrawal: withdrawal.id },
    });
    return { kind: "needs-review", why: message };
  }

  // Step 3.
  await prisma.withdrawal.update({
    where: { id: withdrawal.id },
    data: { txHash },
  });

  return { kind: "sent", txHash };
}

/**
 * Moves a broadcast payout to its final state.
 *
 * Separate from sending because confirmation takes longer than a worker should
 * hold a job for, and because a process that dies while waiting must not lose
 * the transaction — the hash is already on the row.
 */
export async function settleWithdrawal(
  withdrawalId: string,
  sender: Sender,
): Promise<"settled" | "pending" | "failed" | "skipped"> {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal || withdrawal.status !== "SENDING" || !withdrawal.txHash) return "skipped";

  const state = await sender.confirm(withdrawal.txHash);
  if (state === "pending") return "pending";

  if (state === "failed") {
    // The chain rejected it, so nothing moved and the amount is genuinely back.
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: "FAILED",
        failureReason: "The transaction failed on chain. Your balance is unchanged.",
      },
    });
    void notify({
      userId: withdrawal.userId,
      kind: "withdrawal",
      subject: "Withdrawal could not be sent",
      body: `The transaction failed on chain. ${money(withdrawal.amount)} is back in your balance and you can try again.`,
    }).catch(() => undefined);
    return "failed";
  }

  await prisma.withdrawal.update({
    where: { id: withdrawal.id },
    data: { status: "SETTLED", settledAt: new Date() },
  });
  void notify({
    userId: withdrawal.userId,
    kind: "withdrawal",
    subject: "Paid",
    body: `${money(withdrawal.amount)} is on its way. Transaction ${withdrawal.txHash}.`,
  }).catch(() => undefined);
  return "settled";
}

async function checkCaps(
  withdrawal: Withdrawal,
  sender: Sender,
): Promise<SkipReason | null> {
  if (withdrawal.amount.greaterThan(PER_PAYOUT_CAP)) return "over-per-payout-cap";

  const since = new Date(Date.now() - 24 * 3600_000);
  const today = await prisma.withdrawal.aggregate({
    where: {
      status: { in: ["SENDING", "SETTLED"] },
      requestedAt: { gte: since },
    },
    _sum: { amount: true },
  });
  if ((today._sum.amount ?? ZERO).add(withdrawal.amount).greaterThan(DAILY_CAP)) {
    return "over-daily-cap";
  }

  const float = await sender.balanceUsd();
  if (float.lessThan(withdrawal.amount)) return "insufficient-float";

  return null;
}

/**
 * Releases held withdrawals whose hold window has passed. §6.1.
 *
 * FLAGGED is never released by this job. Its hold is not a timer, it is a
 * person — releasing it on a clock would quietly undo every manual review.
 */
export async function releaseMaturedHolds(now = new Date()): Promise<number> {
  const held = await prisma.withdrawal.findMany({
    where: { status: "HELD" },
    select: { id: true, requestedAt: true, user: { select: { riskTier: true } } },
  });

  const due = held.filter((row) => {
    const tier = row.user.riskTier;
    if (tier === "FLAGGED") return false;
    // Read from the member's CURRENT tier, not the one they had when they
    // asked. Someone promoted mid-hold is released early, which is generous and
    // correct; someone flagged mid-hold stops being released, which is the
    // point of flagging them.
    if (tier === "TRUSTED") return true;

    const hours = tier === "NEW" ? 72 : 24;
    return row.requestedAt.getTime() + hours * 3600_000 <= now.getTime();
  });

  if (due.length === 0) return 0;

  const { count } = await prisma.withdrawal.updateMany({
    where: { id: { in: due.map((row) => row.id) }, status: "HELD" },
    data: { status: "APPROVED" },
  });
  return count;
}
