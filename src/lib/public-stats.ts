import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { completionRate, MIN_SAMPLES } from "@/lib/offers";
import { UNKNOWN_COUNTRY } from "@/lib/country";

/**
 * §8's four public claims, each computed from rows.
 *
 * "These numbers must be computed, not configured. The entire trust proposition
 * collapses the first time someone notices a hardcoded figure. If a number
 * cannot be computed yet, return null and have the frontend hide that row
 * rather than showing a placeholder."
 *
 * That rule is load-bearing here: every function below returns null rather than
 * zero when there is no evidence, because zero reads as a measurement and null
 * reads as an absence. A product whose pitch is "we show you the real numbers"
 * cannot afford the difference to be invisible.
 */

const ZERO = new Prisma.Decimal(0);
const DAY = 24 * 3600_000;

export type PublicPayout = {
  date: string;
  handle: string | null;
  chain: string;
  txHash: string;
  amount: string;
};

/** §8: last 12 settled withdrawals. Handle omitted when the member opted out. */
export async function recentPayouts(limit = 12): Promise<PublicPayout[]> {
  const rows = await prisma.withdrawal.findMany({
    where: { status: "SETTLED", txHash: { not: null }, settledAt: { not: null } },
    orderBy: { settledAt: "desc" },
    take: limit,
    select: {
      settledAt: true,
      chain: true,
      txHash: true,
      amount: true,
      user: { select: { handle: true, publicPayouts: true } },
    },
  });

  return rows.map((row) => ({
    // Date only. The exact minute of a payout, next to a handle and a chain,
    // is enough to link a member to an on-chain identity they did not choose
    // to publish.
    date: (row.settledAt as Date).toISOString().slice(0, 10),
    handle: row.user.publicPayouts ? row.user.handle : null,
    chain: row.chain,
    txHash: row.txHash as string,
    amount: row.amount.toFixed(2),
  }));
}

export type PublicStats = {
  paidToDate: string;
  paidLast7d: string;
  withdrawalCount: number;
  refusedCount: number;
};

export async function publicStats(now = new Date()): Promise<PublicStats> {
  const since = new Date(now.getTime() - 7 * DAY);

  const [allTime, week, count, refused] = await Promise.all([
    prisma.withdrawal.aggregate({ where: { status: "SETTLED" }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({
      where: { status: "SETTLED", settledAt: { gte: since } },
      _sum: { amount: true },
    }),
    prisma.withdrawal.count({ where: { status: "SETTLED" } }),
    // §8: "a computed count of Withdrawal.status = FAILED where the failure was
    // our decision rather than a chain error." An operator rejection writes its
    // reason through the admin panel; a chain failure writes the fixed sentence
    // settleWithdrawal uses. Distinguishing them on that sentence is fragile,
    // so the audit trail decides instead — it is the record of our decisions.
    prisma.adminAction.count({ where: { action: "reject-withdrawal" } }),
  ]);

  return {
    paidToDate: (allTime._sum.amount ?? ZERO).toFixed(2),
    paidLast7d: (week._sum.amount ?? ZERO).toFixed(2),
    withdrawalCount: count,
    refusedCount: refused,
  };
}

export type Availability = {
  offerCount: number;
  networksLive: number;
  qualifyRate: number | null;
  surveyRange: { low: string; high: string } | null;
  bestRealisticTier: { label: string; amount: string } | null;
  rails: string[];
  note: string | null;
};

/**
 * §8: what someone in a given country can actually expect, before they sign up.
 *
 * `note` is the one editorial field §8 allows, and it is null until an operator
 * writes one — an invented note is exactly the hardcoded figure the section
 * forbids, just in prose.
 */
export async function availability(countryCode: string): Promise<Availability> {
  const country = countryCode.toUpperCase();
  if (country === UNKNOWN_COUNTRY || !/^[A-Z]{2}$/.test(country)) {
    return {
      offerCount: 0,
      networksLive: 0,
      qualifyRate: null,
      surveyRange: null,
      bestRealisticTier: null,
      rails: RAILS,
      note: null,
    };
  }

  // Selected field by field rather than included wholesale. Offer.advertiserPays
  // is marked "NEVER expose via public API" in the schema, and a select list is
  // the only version of that rule a later edit cannot quietly undo.
  const offers = await prisma.offer.findMany({
    where: { isActive: true, countries: { has: country } },
    select: {
      network: true,
      category: true,
      userPays: true,
      tiers: {
        orderBy: { sequence: "asc" },
        select: { label: true, userPays: true, completions: true, starts: true },
      },
    },
  });

  const networksLive = new Set(offers.map((offer) => offer.network)).size;

  // starts and completions live on the tier, not the offer — an offer has no
  // single completion rate because each tier is reached by fewer people.
  const starts = offers.reduce(
    (total, offer) => total + offer.tiers.reduce((sum, tier) => sum + tier.starts, 0),
    0,
  );
  const completions = offers.reduce(
    (total, offer) => total + offer.tiers.reduce((sum, tier) => sum + tier.completions, 0),
    0,
  );
  // Below MIN_SAMPLES this is null, not a number computed from four data
  // points — the same floor /tasks uses, so the public page and the member
  // page cannot disagree.
  const qualifyRate = completionRate(completions, starts);

  const surveys = offers.filter((offer) => offer.category === "SURVEY");
  const surveyRange =
    surveys.length > 0
      ? {
          low: surveys
            .reduce((min, offer) => (offer.userPays.lessThan(min) ? offer.userPays : min), surveys[0]!.userPays)
            .toFixed(2),
          high: surveys
            .reduce((max, offer) => (offer.userPays.greaterThan(max) ? offer.userPays : max), surveys[0]!.userPays)
            .toFixed(2),
        }
      : null;

  return {
    offerCount: offers.length,
    networksLive,
    qualifyRate,
    surveyRange,
    bestRealisticTier: bestRealisticTier(offers),
    rails: RAILS,
    note: null,
  };
}

const RAILS = ["Solana · USDC", "Base · ETH"];

/**
 * The best tier a person can realistically expect to reach — not the headline.
 *
 * The headline number on an offer wall is the final tier of a month-long game
 * grind that almost nobody finishes. Quoting it is the practice this product
 * positions against, so what is published is the largest tier that at least
 * some people actually reached, and null when there is not enough history to
 * say.
 */
function bestRealisticTier(
  offers: { tiers: { label: string; userPays: Prisma.Decimal; completions: number }[] }[],
): { label: string; amount: string } | null {
  let best: { label: string; amount: Prisma.Decimal } | null = null;

  for (const offer of offers) {
    for (const tier of offer.tiers) {
      if (tier.completions < MIN_SAMPLES) continue;
      if (!best || tier.userPays.greaterThan(best.amount)) {
        best = { label: tier.label, amount: tier.userPays };
      }
    }
  }

  return best ? { label: best.label, amount: best.amount.toFixed(2) } : null;
}

export type Sla = {
  firstReplyHours: number | null;
  escalationHours: number | null;
  medianResolutionDays: number | null;
  paidRate: number | null;
  sampleSize: number;
};

/** §8: rolling 90 days, computed from Dispute rows. */
export async function sla(now = new Date()): Promise<Sla> {
  const since = new Date(now.getTime() - 90 * DAY);

  const disputes = await prisma.dispute.findMany({
    where: { createdAt: { gte: since } },
    select: {
      createdAt: true,
      firstReplyAt: true,
      escalatedAt: true,
      resolvedAt: true,
      outcome: true,
    },
  });

  if (disputes.length === 0) {
    return {
      firstReplyHours: null,
      escalationHours: null,
      medianResolutionDays: null,
      paidRate: null,
      sampleSize: 0,
    };
  }

  const hoursTo = (from: Date, to: Date | null) =>
    to ? (to.getTime() - from.getTime()) / 3600_000 : null;

  const firstReplies = disputes
    .map((row) => hoursTo(row.createdAt, row.firstReplyAt))
    .filter((value): value is number => value !== null);
  const escalations = disputes
    .map((row) => hoursTo(row.createdAt, row.escalatedAt))
    .filter((value): value is number => value !== null);
  const resolutions = disputes
    .map((row) => hoursTo(row.createdAt, row.resolvedAt))
    .filter((value): value is number => value !== null);

  const resolved = disputes.filter((row) => row.outcome !== null);
  const paid = resolved.filter((row) => row.outcome === "PAID");

  return {
    // Median, not mean, for the two a member reads as a promise: one dispute
    // that sat for a month would drag a mean into uselessness while the typical
    // experience stayed unchanged.
    firstReplyHours: round(median(firstReplies), 1),
    escalationHours: round(median(escalations), 1),
    medianResolutionDays: round(median(resolutions.map((hours) => hours / 24)), 1),
    paidRate: resolved.length > 0 ? round(paid.length / resolved.length, 3) : null,
    sampleSize: disputes.length,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function round(value: number | null, places: number): number | null {
  if (value === null) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
