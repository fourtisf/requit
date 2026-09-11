import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Balance = {
  /** Withdrawable right now. */
  available: Prisma.Decimal;
  /** Confirmed but still inside its hold window. */
  pending: Prisma.Decimal;
  /** Settled withdrawals, all time. */
  paidOut: Prisma.Decimal;
  /**
   * Reversed after the member had already been paid. Not deducted from
   * `available` — §4.2 forbids a negative balance nobody can clear — so it is
   * surfaced separately as what it is: our loss.
   */
  shortfall: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);

/**
 * Recomputed from Reward and Withdrawal rows every time. §6.1: "never trust a
 * cached balance column." A cached balance is a second source of truth, and the
 * moment it disagrees with the rows, one of them is paying out money that does
 * not exist.
 */
export async function balanceOf(userId: string): Promise<Balance> {
  const [byStatus, withdrawn] = await Promise.all([
    prisma.reward.groupBy({
      by: ["status"],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.withdrawal.groupBy({
      by: ["status"],
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  const rewards = (status: string) =>
    byStatus.find((row) => row.status === status)?._sum.amount ?? ZERO;

  // Anything not FAILED is money committed: a withdrawal in flight has left the
  // balance even though it has not settled.
  const committed = withdrawn
    .filter((row) => row.status !== "FAILED")
    .reduce((total, row) => total.add(row._sum.amount ?? ZERO), ZERO);

  const earned = rewards("AVAILABLE");
  const raw = earned.sub(committed);

  return {
    available: raw.isNegative() ? ZERO : raw,
    pending: rewards("PENDING"),
    paidOut:
      withdrawn.find((row) => row.status === "SETTLED")?._sum.amount ?? ZERO,
    shortfall: raw.isNegative() ? raw.abs() : ZERO,
  };
}
