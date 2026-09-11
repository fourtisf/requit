import type { OfferCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNKNOWN_COUNTRY } from "@/lib/country";

/**
 * Below this many starts a completion rate is noise. §4.4: "Display 'Not enough
 * data' until starts >= 30. Never show a rate derived from a handful of
 * samples."
 */
export const MIN_SAMPLES = 30;

/** §4.4: a tier below this is rendered struck through — people do not reach it. */
export const DEAD_TIER_RATE = 0.05;

export type TierView = {
  id: string;
  sequence: number;
  label: string;
  userPays: string;
  /** Null until there are enough samples to mean anything. */
  completionRate: number | null;
  starts: number;
  /** True when the rate is real AND below the threshold. */
  unreachable: boolean;
};

export type OfferView = {
  id: string;
  network: string;
  name: string;
  description: string | null;
  category: OfferCategory;
  userPays: string;
  requiresPurchase: boolean;
  purchaseAmount: string | null;
  deadlineDays: number | null;
  devices: string[];
  tiers: TierView[];
};

/**
 * Completion rate, computed — never stored. A number typed by a human here is
 * the one thing that would end the product's whole argument.
 */
export function completionRate(completions: number, starts: number): number | null {
  if (starts < MIN_SAMPLES) return null;
  return completions / starts;
}

export type OfferFilter = {
  countryCode: string;
  /** "ios" | "android" | "desktop" — null shows everything. */
  device?: string | null;
  category?: OfferCategory | null;
};

/**
 * The task list for one member.
 *
 * An unknown country returns nothing rather than everything. Offers are matched
 * by country, and showing a member work they cannot be paid for is the exact
 * complaint this product exists to avoid.
 */
export async function offersFor(filter: OfferFilter): Promise<OfferView[]> {
  if (filter.countryCode === UNKNOWN_COUNTRY) return [];

  const where: Prisma.OfferWhereInput = {
    isActive: true,
    // An empty `countries` means the offer is available everywhere.
    OR: [{ countries: { isEmpty: true } }, { countries: { has: filter.countryCode } }],
    ...(filter.category ? { category: filter.category } : {}),
    // ANDed with the country clause above: an offer has to match both.
    ...(filter.device ? { devices: { has: filter.device } } : {}),
  };

  const offers = await prisma.offer.findMany({
    where,
    orderBy: [{ userPays: "desc" }],
    take: 200,
    select: {
      id: true,
      network: true,
      name: true,
      description: true,
      category: true,
      userPays: true,
      requiresPurchase: true,
      purchaseAmount: true,
      deadlineDays: true,
      devices: true,
      tiers: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          label: true,
          userPays: true,
          completions: true,
          starts: true,
        },
      },
    },
  });

  return offers.map((offer) => ({
    id: offer.id,
    network: offer.network,
    name: offer.name,
    description: offer.description,
    category: offer.category,
    userPays: offer.userPays.toString(),
    requiresPurchase: offer.requiresPurchase,
    purchaseAmount: offer.purchaseAmount?.toString() ?? null,
    deadlineDays: offer.deadlineDays,
    devices: offer.devices,
    tiers: offer.tiers.map((tier) => {
      const rate = completionRate(tier.completions, tier.starts);
      return {
        id: tier.id,
        sequence: tier.sequence,
        label: tier.label,
        userPays: tier.userPays.toString(),
        completionRate: rate,
        starts: tier.starts,
        unreachable: rate !== null && rate < DEAD_TIER_RATE,
      };
    }),
  }));
}

/**
 * Counts a start. This is the denominator of every completion rate on the site,
 * so it has to happen when the member opens the offer — not when they finish.
 */
export async function recordStart(offerId: string): Promise<void> {
  await prisma.offerTier.updateMany({
    where: { offerId },
    data: { starts: { increment: 1 } },
  });
}
