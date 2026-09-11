import { Prisma, type Withdrawal, type WithdrawalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TIER_RULES } from "@/lib/risk";

/** §6.1. Below this the network fee is a meaningful share of the payout. */
export const MIN_WITHDRAWAL = new Prisma.Decimal("10");

export type WithdrawFailure =
  | "unknown-wallet"
  | "wallet-not-verified"
  | "below-minimum"
  | "insufficient-balance"
  | "suspended";

export type WithdrawResult =
  | { ok: true; withdrawal: Withdrawal; replayed: boolean }
  | { ok: false; reason: WithdrawFailure; available?: Prisma.Decimal };

/**
 * Which status a request lands in, from the member's tier alone.
 *
 * §6.1: TRUSTED is released immediately; everyone else waits. FLAGGED waits
 * without a timer, because what it waits for is a person, not a clock.
 */
export function initialStatus(tier: keyof typeof TIER_RULES): WithdrawalStatus {
  if (tier === "TRUSTED") return "APPROVED";
  return "HELD";
}

/**
 * §6.1, and the handoff is right that the idempotency key is the single most
 * important guard here: without it a double-clicked button drains the hot
 * wallet. It is a unique column, so the duplicate is refused by Postgres rather
 * than by a check that races.
 *
 * Everything else happens inside one transaction with the user row locked. The
 * balance is recomputed from Reward rows inside that lock — a balance read
 * before the lock is a balance that can be spent twice by two concurrent
 * requests, which is the same drain by a slower route.
 */
export async function requestWithdrawal(input: {
  userId: string;
  walletId: string;
  amount: Prisma.Decimal;
  idempotencyKey: string;
}): Promise<WithdrawResult> {
  // A replay must return the original, not a second row, and must do so without
  // re-running any of the checks — the answer to "did this already happen" is
  // the row, whatever the balance looks like now.
  const existing = await prisma.withdrawal.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    if (existing.userId !== input.userId) {
      // Someone else's key. Treat it as unknown rather than confirming it exists.
      return { ok: false, reason: "unknown-wallet" };
    }
    return { ok: true, withdrawal: existing, replayed: true };
  }

  if (input.amount.lessThan(MIN_WITHDRAWAL)) {
    return { ok: false, reason: "below-minimum" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // §6.1 step 1. Serialises concurrent requests from the same member, so
      // the balance computed below cannot be spent by a request that is already
      // in flight.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`;

      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { riskTier: true, suspendedAt: true },
      });
      if (!user) return { ok: false, reason: "unknown-wallet" } as const;
      if (user.suspendedAt) return { ok: false, reason: "suspended" } as const;

      const wallet = await tx.wallet.findUnique({
        where: { id: input.walletId },
        select: { userId: true, chain: true, verifiedAt: true },
      });
      if (!wallet || wallet.userId !== input.userId) {
        return { ok: false, reason: "unknown-wallet" } as const;
      }
      if (wallet.verifiedAt === null) {
        return { ok: false, reason: "wallet-not-verified" } as const;
      }

      // §6.1 step 2: recomputed inside the lock, never read from a column.
      const available = await availableInside(tx, input.userId);
      if (input.amount.greaterThan(available)) {
        return { ok: false, reason: "insufficient-balance", available } as const;
      }

      const status = initialStatus(user.riskTier);
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: input.userId,
          walletId: input.walletId,
          chain: wallet.chain,
          amount: input.amount,
          status,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return { ok: true, withdrawal, replayed: false } as const;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Two requests with the same key raced past the read above. The loser
      // reads the winner's row instead of creating a second withdrawal.
      const winner = await prisma.withdrawal.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (winner && winner.userId === input.userId) {
        return { ok: true, withdrawal: winner, replayed: true };
      }
    }
    throw error;
  }
}

const ZERO = new Prisma.Decimal(0);

/**
 * Available balance, computed inside an open transaction.
 *
 * Deliberately not balanceOf(): that one uses its own connection, so it would
 * read outside the lock this function exists to be protected by.
 */
async function availableInside(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<Prisma.Decimal> {
  const [rewards, withdrawals] = await Promise.all([
    tx.reward.aggregate({ where: { userId, status: "AVAILABLE" }, _sum: { amount: true } }),
    tx.withdrawal.groupBy({ by: ["status"], where: { userId }, _sum: { amount: true } }),
  ]);

  const committed = withdrawals
    .filter((row) => row.status !== "FAILED")
    .reduce((total, row) => total.add(row._sum.amount ?? ZERO), ZERO);

  const raw = (rewards._sum.amount ?? ZERO).sub(committed);
  return raw.isNegative() ? ZERO : raw;
}

/** When a held withdrawal becomes releasable. Null means it waits for a person. */
export function releaseAt(
  tier: keyof typeof TIER_RULES,
  requestedAt: Date,
): Date | null {
  const hours = TIER_RULES[tier].holdHours;
  if (hours === null) return null;
  return new Date(requestedAt.getTime() + hours * 3600_000);
}
