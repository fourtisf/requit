import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ZERO = new Prisma.Decimal(0);

export type Treasury = {
  /** Confirmed by a network and past its hold — members can ask for it now. */
  owedNow: Prisma.Decimal;
  /** Confirmed but still inside the hold window. Owed soon. */
  owedSoon: Prisma.Decimal;
  /** Requested or held, awaiting review or sending. */
  inFlight: Prisma.Decimal;
  /** Paid out, all time. */
  settled: Prisma.Decimal;
  /** Invoiced to networks and not yet received — what covers the liability. */
  receivable: Prisma.Decimal;
  /**
   * Reversed after the member was already paid. Unrecoverable; kept visible so
   * the number is a cost line rather than a silent hole in the float.
   */
  writtenOff: Prisma.Decimal;
  queues: { held: number; requested: number; disputes: number; flagged: number };
};

/**
 * What the operator actually needs to know: can we pay what we owe.
 *
 * Every figure is summed from rows, for the same reason balanceOf() is —
 * §6.1's "never trust a cached balance" applies harder here, because this is
 * the number that decides whether withdrawals stay open.
 */
export async function treasury(): Promise<Treasury> {
  const [rewards, withdrawals, invoices, held, requested, disputes, flagged, shortfalls] =
    await Promise.all([
      prisma.reward.groupBy({ by: ["status"], _sum: { amount: true } }),
      prisma.withdrawal.groupBy({ by: ["status"], _sum: { amount: true } }),
      prisma.networkInvoice.aggregate({
        where: { paidAt: null },
        _sum: { amountDue: true },
      }),
      prisma.withdrawal.count({ where: { status: "HELD" } }),
      prisma.withdrawal.count({ where: { status: "REQUESTED" } }),
      prisma.dispute.count({ where: { status: { not: "RESOLVED" } } }),
      prisma.user.count({ where: { riskTier: "FLAGGED" } }),
      prisma.reward.aggregate({ where: { status: "REVERSED" }, _sum: { amount: true } }),
    ]);

  const reward = (status: string) =>
    rewards.find((row) => row.status === status)?._sum.amount ?? ZERO;
  const withdrawal = (status: string) =>
    withdrawals.find((row) => row.status === status)?._sum.amount ?? ZERO;

  const committed = withdrawals
    .filter((row) => row.status !== "FAILED")
    .reduce((total, row) => total.add(row._sum.amount ?? ZERO), ZERO);

  const owedNow = reward("AVAILABLE").sub(committed);

  return {
    owedNow: owedNow.isNegative() ? ZERO : owedNow,
    owedSoon: reward("PENDING"),
    inFlight: withdrawal("REQUESTED").add(withdrawal("HELD")).add(withdrawal("APPROVED")).add(withdrawal("SENDING")),
    settled: withdrawal("SETTLED"),
    receivable: invoices._sum.amountDue ?? ZERO,
    writtenOff: shortfalls._sum.amount ?? ZERO,
    queues: { held, requested, disputes, flagged },
  };
}

/** Money owed to members, in total. The liability the float has to cover. */
export function liability(figures: Treasury): Prisma.Decimal {
  return figures.owedNow.add(figures.owedSoon).add(figures.inFlight);
}
