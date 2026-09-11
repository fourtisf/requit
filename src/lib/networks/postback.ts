import { Prisma, type Network, type RiskTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TIER_RULES } from "@/lib/risk";

/**
 * Every network sends different parameter names for the same six facts. Like
 * the signature spec, these are the shapes each network is known to use and
 * none has been checked against its publisher documentation — the signature
 * gate blocks all of them until someone does.
 */
type ParamMap = {
  user: string;
  txn: string;
  /** What the member is paid. */
  amount: string;
  /** What the advertiser paid us. Never exposed publicly (§3). */
  advertiserPaid?: string;
  offer?: string;
  tier?: string;
  status?: string;
  /** Value of `status` that means a reversal; anything else is a credit. */
  reversalValue?: string;
};

export const PARAM_MAPS: Record<Network, ParamMap> = {
  CPX: {
    user: "user_id",
    txn: "trans_id",
    amount: "amount_local",
    advertiserPaid: "amount_usd",
    offer: "offer_id",
    status: "status",
    reversalValue: "2",
  },
  LOOTABLY: {
    user: "userID",
    txn: "transactionID",
    amount: "currencyReward",
    advertiserPaid: "revenue",
    offer: "offerID",
    tier: "offerName",
    status: "status",
    reversalValue: "2",
  },
  TIMEWALL: {
    user: "userID",
    txn: "transactionID",
    amount: "currencyAmount",
    advertiserPaid: "revenue",
    offer: "offerID",
    status: "type",
    reversalValue: "chargeback",
  },
  TOROX: {
    user: "user_id",
    txn: "oid",
    amount: "payout",
    advertiserPaid: "revenue",
    offer: "offer_id",
    tier: "offer_name",
    status: "status",
    reversalValue: "2",
  },
};

export type ParsedPostback = {
  userId: string;
  networkTxnId: string;
  amount: Prisma.Decimal;
  advertiserPaid: Prisma.Decimal;
  networkOfferId: string | null;
  tierLabel: string | null;
  reversal: boolean;
};

export type ParseFailure = "missing-user" | "missing-txn" | "bad-amount";

export function parsePostback(
  network: Network,
  params: Record<string, string>,
): ParsedPostback | ParseFailure {
  const map = PARAM_MAPS[network];

  const userId = params[map.user]?.trim();
  if (!userId) return "missing-user";

  const networkTxnId = params[map.txn]?.trim();
  if (!networkTxnId) return "missing-txn";

  const amount = decimalOrNull(params[map.amount]);
  if (amount === null) return "bad-amount";

  const advertiserPaid = map.advertiserPaid
    ? (decimalOrNull(params[map.advertiserPaid]) ?? new Prisma.Decimal(0))
    : new Prisma.Decimal(0);

  const statusValue = map.status ? params[map.status]?.trim() : undefined;

  return {
    userId,
    networkTxnId,
    // A reversal arrives as a negative amount on some networks. Store the
    // magnitude; `reversal` carries the direction.
    amount: amount.abs(),
    advertiserPaid: advertiserPaid.abs(),
    networkOfferId: (map.offer ? params[map.offer]?.trim() : undefined) ?? null,
    tierLabel: (map.tier ? params[map.tier]?.trim() : undefined) ?? null,
    reversal:
      (map.reversalValue !== undefined && statusValue === map.reversalValue) ||
      amount.isNegative(),
  };
}

function decimalOrNull(raw: string | undefined): Prisma.Decimal | null {
  if (raw === undefined || raw.trim() === "") return null;
  try {
    const value = new Prisma.Decimal(raw.trim());
    return value.isFinite() ? value : null;
  } catch {
    return null;
  }
}

export type PostbackOutcome =
  | { kind: "credited"; rewardId: string; availableAt: Date | null }
  | { kind: "duplicate" }
  | { kind: "reversed"; rewardId: string; afterWithdrawal: boolean }
  | { kind: "reversal-unknown" }
  | { kind: "user-not-found" };

/**
 * Applies a parsed postback.
 *
 * The unique constraint on (network, networkTxnId) is the real dedupe — §4.2
 * says so, and a read-then-write check would still race two concurrent retries.
 * We catch P2002 and report a duplicate, so the caller can still answer 200 and
 * the network stops retrying.
 */
export async function applyPostback(
  network: Network,
  parsed: ParsedPostback,
  rawPayload: Prisma.InputJsonValue,
): Promise<PostbackOutcome> {
  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, countryCode: true, riskTier: true },
  });
  if (!user) return { kind: "user-not-found" };

  if (parsed.reversal) return reverse(network, parsed);

  const availableAt = holdUntil(user.riskTier);

  try {
    const reward = await prisma.reward.create({
      data: {
        userId: user.id,
        network,
        networkTxnId: parsed.networkTxnId,
        offerId: await resolveOfferId(network, parsed.networkOfferId),
        tierLabel: parsed.tierLabel,
        amount: parsed.amount,
        advertiserPaid: parsed.advertiserPaid,
        countryCode: user.countryCode,
        rawPayload,
        status: "PENDING",
        availableAt,
      },
      select: { id: true },
    });

    if (parsed.networkOfferId && parsed.tierLabel) {
      await countTierCompletion(network, parsed.networkOfferId, parsed.tierLabel);
    }

    return { kind: "credited", rewardId: reward.id, availableAt };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { kind: "duplicate" };
    }
    throw error;
  }
}

/**
 * §4.2: "A reversal on an already-withdrawn reward is a real loss — record it,
 * flag the user, do NOT create a negative balance the user can never clear."
 */
async function reverse(network: Network, parsed: ParsedPostback): Promise<PostbackOutcome> {
  const existing = await prisma.reward.findUnique({
    where: { network_networkTxnId: { network, networkTxnId: parsed.networkTxnId } },
    select: { id: true, userId: true, status: true },
  });

  // A reversal for something we never credited. Nothing to take back, and
  // inventing a negative row would be inventing a debt.
  if (!existing) return { kind: "reversal-unknown" };
  if (existing.status === "REVERSED") return { kind: "duplicate" };

  const alreadyPaidOut = existing.status === "AVAILABLE";

  await prisma.$transaction(async (tx) => {
    await tx.reward.update({
      where: { id: existing.id },
      data: { status: "REVERSED", reversedAt: new Date() },
    });

    if (alreadyPaidOut) {
      // The money may already be gone. Flag rather than chase: §7 sends a
      // flagged account's withdrawals to a person, which is the control that
      // actually stops the next one.
      await tx.user.update({
        where: { id: existing.userId },
        data: { riskTier: "FLAGGED" },
      });
    }
  });

  return { kind: "reversed", rewardId: existing.id, afterWithdrawal: alreadyPaidOut };
}

/** Null for a TRUSTED member — nothing to wait for. */
export function holdUntil(tier: RiskTier, now = new Date()): Date | null {
  const hours = TIER_RULES[tier].holdHours;
  if (hours === null) return null;
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

async function resolveOfferId(network: Network, networkOfferId: string | null) {
  if (!networkOfferId) return null;
  const offer = await prisma.offer.findUnique({
    where: { network_networkOfferId: { network, networkOfferId } },
    select: { id: true },
  });
  return offer?.id ?? null;
}

/**
 * Completion rate is `completions / starts` and never a stored number (§4.4).
 * This is the increment that makes the numerator real.
 */
async function countTierCompletion(network: Network, networkOfferId: string, tierLabel: string) {
  const offer = await prisma.offer.findUnique({
    where: { network_networkOfferId: { network, networkOfferId } },
    select: { id: true },
  });
  if (!offer) return;

  await prisma.offerTier.updateMany({
    where: { offerId: offer.id, label: tierLabel },
    data: { completions: { increment: 1 } },
  });
}
