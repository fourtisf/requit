import type { OfferCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import { canHandOff } from "@/lib/networks/handoff";

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

/**
 * How hard the offer is to finish at all, from the share of starters who
 * cleared its lowest bar.
 *
 * Null is not "moderate" — it means nobody has run this offer enough times to
 * say, and the page must print that rather than guess. §4.4 again: an
 * easy-looking badge derived from four people is worse than no badge, because
 * someone acts on it.
 */
export type Ease = "easy" | "moderate" | "hard";

/** At least this share of starters clear the first tier → "easy". */
export const EASY_RATE = 0.5;
/** Below this → "hard". Between the two → "moderate". */
export const MODERATE_RATE = 0.2;

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
  /**
   * False when a click could not carry the member's id to the network. The
   * button renders as unavailable rather than letting someone start work that
   * could never be credited to them.
   */
  canStart: boolean;
  /** Null until the first tier has enough starts to mean anything. */
  ease: Ease | null;
  /** The first tier's completion rate, or null. Drives `ease` and the sort. */
  entryRate: number | null;
};

/**
 * Completion rate, computed — never stored. A number typed by a human here is
 * the one thing that would end the product's whole argument.
 */
export function completionRate(completions: number, starts: number): number | null {
  if (starts < MIN_SAMPLES) return null;
  return completions / starts;
}

/**
 * The easiness of an offer, measured at its lowest bar.
 *
 * The first tier is the right one to read. It is the smallest thing the offer
 * asks for, so the share of starters who cleared it is the share who got
 * anything at all — which is what "easy to play" means to someone deciding
 * whether to spend an evening on it. Reading the headline tier instead would
 * call every offer hard, since headline tiers are designed to be rare.
 */
export function easeOf(
  tiers: readonly TierView[],
): { ease: Ease | null; entryRate: number | null } {
  const first = tiers[0];
  if (!first || first.completionRate === null)
    return { ease: null, entryRate: null };

  const rate = first.completionRate;
  const ease: Ease = rate >= EASY_RATE ? "easy" : rate >= MODERATE_RATE ? "moderate" : "hard";
  return { ease, entryRate: rate };
}

/**
 * Light enough to finish in an evening, with nothing to pay up front.
 *
 * Two exclusions, and only two, because both are facts rather than opinions:
 *
 *   - Measured as hard. Fewer than MODERATE_RATE of the people who started it
 *     cleared even its lowest tier, so calling it a task someone can finish is
 *     not supportable.
 *   - Requires a purchase. Whatever the effort, it is not light if it takes
 *     your own money first.
 *
 * An offer nobody has measured stays in. We do not know that it is heavy, and
 * dropping everything unproven would empty the list on the day the catalogue
 * arrives — the filter would look broken, and the offers would never gather the
 * starts that would prove them either way.
 */
export function isLight(offer: OfferView): boolean {
  return offer.ease !== "hard" && !offer.requiresPurchase;
}

/**
 * Partitions rather than filters, so the page can say what it is not showing.
 *
 * Silently hiding inventory from someone trying to earn money is the kind of
 * thing that is defensible right up until they find out. The count goes on
 * screen with a way to see them.
 */
export function splitLight(offers: readonly OfferView[]): {
  light: OfferView[];
  heavy: OfferView[];
} {
  const light: OfferView[] = [];
  const heavy: OfferView[] = [];
  for (const offer of offers) (isLight(offer) ? light : heavy).push(offer);
  return { light, heavy };
}

/** "ease" leads with what people actually finish; "reward" with the biggest number. */
export type OfferSort = "ease" | "reward";

export const DEFAULT_SORT: OfferSort = "ease";

export function parseSort(value: string | undefined): OfferSort {
  return value === "reward" ? "reward" : DEFAULT_SORT;
}

/**
 * Easiest first, unmeasured offers after the measured ones, reward as the
 * tie-break.
 *
 * Putting the unmeasured ones last rather than in the middle is deliberate: a
 * brand-new offer has no claim on the top of the list, and while the whole
 * catalogue is unmeasured this degrades to exactly the reward ordering the page
 * had before — so a fresh install looks the same as it always did instead of
 * looking shuffled.
 */
export function byEase(a: OfferView, b: OfferView): number {
  const left = a.entryRate;
  const right = b.entryRate;
  if (left !== right) {
    if (left === null) return 1;
    if (right === null) return -1;
    if (right !== left) return right - left;
  }
  return Number(b.userPays) - Number(a.userPays);
}

export type OfferFilter = {
  countryCode: string;
  /** "ios" | "android" | "desktop" — null shows everything. */
  device?: string | null;
  category?: OfferCategory | null;
  /** Defaults to easiest-first. */
  sort?: OfferSort;
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
      trackingUrl: true,
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

  const views: OfferView[] = offers.map((offer) => {
    const tiers = offer.tiers.map((tier) => {
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
    });

    return {
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
      canStart: canHandOff(offer.network, offer.trackingUrl),
      tiers,
      ...easeOf(tiers),
    };
  });

  // Sorted here rather than in SQL: entryRate is derived from two columns and a
  // sample floor, so the database cannot order by it without duplicating the
  // rule — and a rule in two places is a rule that will disagree with itself.
  if ((filter.sort ?? DEFAULT_SORT) === "ease") views.sort(byEase);

  return views;
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
