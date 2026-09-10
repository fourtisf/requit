/**
 * Development seed — HANDOFF.md §11 step 2.
 *
 * 5 users across 5 countries, 30 offers across all four networks and all six
 * categories, tier rows on the game offers.
 *
 * What it deliberately does NOT create: rewards, withdrawals, or anything that
 * would give the public proof endpoints (§8) something to display. Those numbers
 * must come from real activity — seeded ones have a way of surviving to
 * production and the whole trust proposition rests on every figure being real.
 */
import { PrismaClient, Network, OfferCategory, RiskTier, Chain } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const users = [
  { email: "ada@example.com", handle: "ada_w", countryCode: "US", riskTier: RiskTier.TRUSTED },
  { email: "reid@example.com", handle: "reid_ellery", countryCode: "GB", riskTier: RiskTier.STANDARD },
  { email: "hanna@example.com", handle: "hanna_pw", countryCode: "DE", riskTier: RiskTier.STANDARD },
  { email: "tomas@example.com", handle: "tomas_k", countryCode: "BR", riskTier: RiskTier.NEW },
  { email: "priya@example.com", handle: "priya_nd", countryCode: "IN", riskTier: RiskTier.FLAGGED },
] as const;

type OfferSeed = {
  network: Network;
  networkOfferId: string;
  name: string;
  description: string;
  category: OfferCategory;
  countries: string[];
  devices: string[];
  advertiserPays: string;
  userPays: string;
  requiresPurchase?: boolean;
  purchaseAmount?: string;
  deadlineDays?: number;
  /** [label, userPays] pairs. Game offers only. */
  tiers?: Array<[string, string]>;
};

const ALL_DEVICES = ["ios", "android", "desktop"];
const MOBILE = ["ios", "android"];

const offers: OfferSeed[] = [
  // ── CPX Research — surveys. Screen-outs are the majority of sessions. ──
  { network: Network.CPX, networkOfferId: "cpx-1001", name: "Consumer habits, 12 minutes", description: "Household purchasing panel.", category: OfferCategory.SURVEY, countries: ["US", "GB"], devices: ALL_DEVICES, advertiserPays: "2.4000", userPays: "1.5600" },
  { network: Network.CPX, networkOfferId: "cpx-1002", name: "Streaming subscriptions, 8 minutes", description: "Which services you pay for.", category: OfferCategory.SURVEY, countries: ["US"], devices: ALL_DEVICES, advertiserPays: "1.8000", userPays: "1.1700" },
  { network: Network.CPX, networkOfferId: "cpx-1003", name: "Grocery basket, 15 minutes", description: "Weekly shop composition.", category: OfferCategory.SURVEY, countries: ["GB", "DE"], devices: ALL_DEVICES, advertiserPays: "3.1000", userPays: "2.0100" },
  { network: Network.CPX, networkOfferId: "cpx-1004", name: "Commute and transport, 6 minutes", description: "Short travel diary.", category: OfferCategory.SURVEY, countries: ["DE"], devices: ALL_DEVICES, advertiserPays: "1.2000", userPays: "0.7800" },
  { network: Network.CPX, networkOfferId: "cpx-1005", name: "Financial products, 20 minutes", description: "Banking and credit panel. Long, pays well.", category: OfferCategory.SURVEY, countries: ["US", "GB"], devices: ["desktop"], advertiserPays: "6.5000", userPays: "4.2200" },
  { network: Network.CPX, networkOfferId: "cpx-1006", name: "Mobile gaming habits, 10 minutes", description: "What you play and what you spend.", category: OfferCategory.SURVEY, countries: [], devices: MOBILE, advertiserPays: "2.0000", userPays: "1.3000" },
  { network: Network.CPX, networkOfferId: "cpx-1007", name: "Health and wellness, 14 minutes", description: "General wellbeing panel.", category: OfferCategory.SURVEY, countries: ["BR", "IN"], devices: ALL_DEVICES, advertiserPays: "0.9000", userPays: "0.5800" },

  // ── Lootably — broadest category mix. ──
  { network: Network.LOOTABLY, networkOfferId: "lty-2001", name: "Open a brokerage account", description: "Identity verification required. No deposit.", category: OfferCategory.SIGNUP, countries: ["US"], devices: ALL_DEVICES, advertiserPays: "48.0000", userPays: "31.2000", deadlineDays: 14 },
  { network: Network.LOOTABLY, networkOfferId: "lty-2002", name: "Meal kit — first box", description: "Discounted first box, cancel any time.", category: OfferCategory.SHOPPING, countries: ["US", "GB"], devices: ALL_DEVICES, advertiserPays: "34.0000", userPays: "22.1000", requiresPurchase: true, purchaseAmount: "24.99", deadlineDays: 7 },
  { network: Network.LOOTABLY, networkOfferId: "lty-2003", name: "Language app — 7-day streak", description: "Free tier counts.", category: OfferCategory.APP, countries: [], devices: MOBILE, advertiserPays: "5.2000", userPays: "3.3800", deadlineDays: 10 },
  { network: Network.LOOTABLY, networkOfferId: "lty-2004", name: "Puzzle quest — reach level 40", description: "Free to play. Long grind, high payout.", category: OfferCategory.GAME, countries: ["US", "GB", "DE"], devices: MOBILE, advertiserPays: "112.0000", userPays: "72.8000", deadlineDays: 30, tiers: [["Level 5", "1.4000"], ["Level 15", "6.5000"], ["Level 25", "18.2000"], ["Level 32", "34.9000"], ["Level 40", "72.8000"]] },
  { network: Network.LOOTABLY, networkOfferId: "lty-2005", name: "Fitness tracker app — log 5 workouts", description: "Any activity type.", category: OfferCategory.APP, countries: ["US", "GB", "DE", "BR"], devices: MOBILE, advertiserPays: "4.4000", userPays: "2.8600", deadlineDays: 14 },
  { network: Network.LOOTABLY, networkOfferId: "lty-2006", name: "Recipe tagging — 50 items", description: "Short classification task.", category: OfferCategory.MICROTASK, countries: [], devices: ["desktop"], advertiserPays: "1.1000", userPays: "0.7100" },
  { network: Network.LOOTABLY, networkOfferId: "lty-2007", name: "Subscribe to a beauty box", description: "Monthly box, first payment required.", category: OfferCategory.SHOPPING, countries: ["US"], devices: ALL_DEVICES, advertiserPays: "41.0000", userPays: "26.6500", requiresPurchase: true, purchaseAmount: "19.95", deadlineDays: 7 },
  { network: Network.LOOTABLY, networkOfferId: "lty-2008", name: "Sign up for a savings app", description: "Bank link required. No deposit.", category: OfferCategory.SIGNUP, countries: ["GB"], devices: MOBILE, advertiserPays: "18.0000", userPays: "11.7000", deadlineDays: 14 },

  // ── TimeWall — lowest per-task value, highest volume. ──
  { network: Network.TIMEWALL, networkOfferId: "twl-3001", name: "Watch a 30-second ad", description: "Repeatable, hourly cap.", category: OfferCategory.MICROTASK, countries: [], devices: ALL_DEVICES, advertiserPays: "0.0180", userPays: "0.0117" },
  { network: Network.TIMEWALL, networkOfferId: "twl-3002", name: "Image labelling — 20 items", description: "Pick the matching category.", category: OfferCategory.MICROTASK, countries: [], devices: ALL_DEVICES, advertiserPays: "0.1400", userPays: "0.0910" },
  { network: Network.TIMEWALL, networkOfferId: "twl-3003", name: "Rate a search result page", description: "Relevance judgement.", category: OfferCategory.MICROTASK, countries: ["US", "GB", "IN"], devices: ["desktop"], advertiserPays: "0.2200", userPays: "0.1430" },
  { network: Network.TIMEWALL, networkOfferId: "twl-3004", name: "Transcribe a 15-second clip", description: "Clear audio, English.", category: OfferCategory.MICROTASK, countries: [], devices: ALL_DEVICES, advertiserPays: "0.3100", userPays: "0.2010" },
  { network: Network.TIMEWALL, networkOfferId: "twl-3005", name: "Install a browser extension", description: "Keep it installed 48 hours.", category: OfferCategory.APP, countries: ["US", "DE"], devices: ["desktop"], advertiserPays: "1.6000", userPays: "1.0400", deadlineDays: 3 },
  { network: Network.TIMEWALL, networkOfferId: "twl-3006", name: "Complete a product quiz", description: "Six questions.", category: OfferCategory.SURVEY, countries: [], devices: ALL_DEVICES, advertiserPays: "0.4500", userPays: "0.2900" },
  { network: Network.TIMEWALL, networkOfferId: "twl-3007", name: "Newsletter signup", description: "Confirm the email to credit.", category: OfferCategory.SIGNUP, countries: [], devices: ALL_DEVICES, advertiserPays: "0.8000", userPays: "0.5200", deadlineDays: 2 },

  // ── Torox — high-value multi-tier games. Highest chargeback rate. ──
  { network: Network.TOROX, networkOfferId: "trx-4001", name: "Kingdom builder — reach town hall 12", description: "Free to play. Tiers credit as you pass them.", category: OfferCategory.GAME, countries: ["US", "GB", "DE"], devices: MOBILE, advertiserPays: "186.0000", userPays: "120.9000", deadlineDays: 30, tiers: [["Town hall 4", "2.6000"], ["Town hall 6", "9.1000"], ["Town hall 8", "27.3000"], ["Town hall 10", "61.7000"], ["Town hall 12", "120.9000"]] },
  { network: Network.TOROX, networkOfferId: "trx-4002", name: "Merge islands — board level 32", description: "Free to play.", category: OfferCategory.GAME, countries: ["US", "GB"], devices: MOBILE, advertiserPays: "94.0000", userPays: "61.1000", deadlineDays: 21, tiers: [["Board level 8", "1.9000"], ["Board level 16", "7.8000"], ["Board level 24", "24.4000"], ["Board level 32", "61.1000"]] },
  { network: Network.TOROX, networkOfferId: "trx-4003", name: "Idle tycoon — first prestige", description: "Free to play, roughly two hours.", category: OfferCategory.GAME, countries: [], devices: MOBILE, advertiserPays: "12.0000", userPays: "7.8000", deadlineDays: 14, tiers: [["Tutorial complete", "0.3000"], ["First factory", "1.6000"], ["First prestige", "7.8000"]] },
  { network: Network.TOROX, networkOfferId: "trx-4004", name: "Card battler — complete chapter 3", description: "Free to play. In-app purchases not required.", category: OfferCategory.GAME, countries: ["US", "BR"], devices: MOBILE, advertiserPays: "43.0000", userPays: "27.9500", deadlineDays: 21, tiers: [["Chapter 1", "1.1000"], ["Chapter 2", "6.4000"], ["Chapter 3", "27.9500"]] },
  { network: Network.TOROX, networkOfferId: "trx-4005", name: "Casino app — deposit and play", description: "Deposit required. 18+. Not available everywhere.", category: OfferCategory.APP, countries: ["GB"], devices: ALL_DEVICES, advertiserPays: "78.0000", userPays: "50.7000", requiresPurchase: true, purchaseAmount: "20.00", deadlineDays: 7 },
  { network: Network.TOROX, networkOfferId: "trx-4006", name: "Delivery app — first order", description: "Order value must clear the minimum.", category: OfferCategory.SHOPPING, countries: ["US", "GB", "DE"], devices: MOBILE, advertiserPays: "22.0000", userPays: "14.3000", requiresPurchase: true, purchaseAmount: "15.00", deadlineDays: 7 },
  { network: Network.TOROX, networkOfferId: "trx-4007", name: "Crypto exchange — verify identity", description: "KYC required. No deposit.", category: OfferCategory.SIGNUP, countries: ["BR", "IN"], devices: ALL_DEVICES, advertiserPays: "26.0000", userPays: "16.9000", deadlineDays: 14 },
  { network: Network.TOROX, networkOfferId: "trx-4008", name: "Photo editor — 3-day trial", description: "Cancel before it renews.", category: OfferCategory.APP, countries: ["US"], devices: ["ios"], advertiserPays: "9.5000", userPays: "6.1700", requiresPurchase: true, purchaseAmount: "0.99", deadlineDays: 3 },
];

async function main(): Promise<void> {
  console.log("Seeding…");

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        handle: user.handle,
        countryCode: user.countryCode,
        riskTier: user.riskTier,
        emailVerified: new Date(),
      },
    });
  }

  // One unverified wallet per chain on the first user, so the Phase 2 verify flow
  // has something to exercise. Unverified: seeding a verified wallet would mean
  // seeding a signature nobody produced.
  const ada = await prisma.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
  const seedWallets = [
    { chain: Chain.SOLANA, address: "9xQeWvG816bUx9EPa2rP1kQ4nJ8oTvBcYqk3ZmHt1Rdz" },
    { chain: Chain.BASE, address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  ];

  for (const wallet of seedWallets) {
    await prisma.wallet.upsert({
      where: { chain_address: { chain: wallet.chain, address: wallet.address } },
      update: {},
      create: { userId: ada.id, chain: wallet.chain, address: wallet.address },
    });
  }

  for (const offer of offers) {
    const { tiers, ...fields } = offer;

    const record = await prisma.offer.upsert({
      where: {
        network_networkOfferId: {
          network: fields.network,
          networkOfferId: fields.networkOfferId,
        },
      },
      update: { lastSeenAt: new Date() },
      create: {
        ...fields,
        advertiserPays: new Prisma.Decimal(fields.advertiserPays),
        userPays: new Prisma.Decimal(fields.userPays),
        purchaseAmount: fields.purchaseAmount ? new Prisma.Decimal(fields.purchaseAmount) : null,
      },
    });

    if (!tiers) continue;

    for (const [index, [label, userPays]] of tiers.entries()) {
      await prisma.offerTier.upsert({
        where: { offerId_sequence: { offerId: record.id, sequence: index + 1 } },
        update: { label, userPays: new Prisma.Decimal(userPays) },
        // starts and completions stay at 0. Completion rate is derived from real
        // traffic (HANDOFF.md §4.4) and the UI hides it below 30 samples — a
        // seeded rate would be a fabricated statistic in the product's one
        // load-bearing claim.
        create: {
          offerId: record.id,
          sequence: index + 1,
          label,
          userPays: new Prisma.Decimal(userPays),
        },
      });
    }
  }

  const [userCount, offerCount, tierCount] = await Promise.all([
    prisma.user.count(),
    prisma.offer.count(),
    prisma.offerTier.count(),
  ]);

  console.log(`Seeded ${userCount} users, ${offerCount} offers, ${tierCount} tiers.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
