/**
 * Demo data for the marketing screenshots. NEVER run against production.
 *
 * It deletes every Offer and OfferTier, and creates a session token that would
 * be a standing back door on a live machine.
 *
 * The screenshots on the landing page are rendered from this, and the point of
 * keeping it is that they can be regenerated: a screenshot nobody can rebuild
 * quietly rots into a picture of a product that no longer exists.
 *
 *   npx tsx scripts/seed-demo.ts        # then see public/shots/README.md
 */
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Demo data for the marketing screenshots only.
 *
 * Shaped to be believable rather than flattering: the headline tier is reached
 * by 3% of starters, which is the real shape of these offers and the thing the
 * product exists to show.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run: this deletes every offer and opens a fixed session.");
  }

  // NODE_ENV is set by whoever typed the command, and typing the command in the
  // wrong terminal is the entire failure this guards against. So the real test
  // is whether anyone has ever signed up here: this script deletes every offer,
  // writes three rewards that nobody earned, and opens a session token that is
  // a standing way into somebody's account.
  const members = await prisma.user.count({
    where: { NOT: { email: { endsWith: "@example.com" } } },
  });
  if (members > 0 && process.env.SEED_ANYWAY !== "1") {
    throw new Error(
      `Refusing to run: ${members} real account${members === 1 ? " exists" : "s exist"} here, ` +
        "so this is not a screenshot machine. It would delete every offer, invent three " +
        "rewards, and open a fixed session token.\n\n" +
        "If you are certain: SEED_ANYWAY=1 npx tsx scripts/seed-demo.ts",
    );
  }

  await prisma.offerTier.deleteMany();
  await prisma.offer.deleteMany();

  await prisma.offer.create({
    data: {
      network: "TOROX",
      networkOfferId: "demo-1",
      name: "Kingdom Builder",
      description: "Build a town and reach the milestones below. Android only.",
      category: "GAME",
      countries: ["GB", "US", "ID"],
      devices: ["android"],
      advertiserPays: new Prisma.Decimal("186.0000"),
      userPays: new Prisma.Decimal("120.9000"),
      deadlineDays: 30,
      tiers: {
        create: [
          { sequence: 1, label: "Town hall 4", userPays: new Prisma.Decimal("2.60"), starts: 1840, completions: 1122 },
          { sequence: 2, label: "Town hall 8", userPays: new Prisma.Decimal("14.20"), starts: 1840, completions: 396 },
          { sequence: 3, label: "Town hall 12", userPays: new Prisma.Decimal("39.80"), starts: 1840, completions: 88 },
          { sequence: 4, label: "Town hall 16", userPays: new Prisma.Decimal("64.30"), starts: 1840, completions: 51 },
        ],
      },
    },
  });

  await prisma.offer.create({
    data: {
      network: "CPX",
      networkOfferId: "demo-2",
      name: "Consumer habits survey",
      description: "About 12 minutes. Paid whether or not you qualify past the screener.",
      category: "SURVEY",
      countries: ["GB", "US", "ID"],
      devices: ["android", "ios", "desktop"],
      advertiserPays: new Prisma.Decimal("2.9000"),
      userPays: new Prisma.Decimal("1.8500"),
      tiers: {
        create: [{ sequence: 1, label: "Completed", userPays: new Prisma.Decimal("1.85"), starts: 640, completions: 402 }],
      },
    },
  });

  await prisma.offer.create({
    data: {
      network: "LOOTABLY",
      networkOfferId: "demo-3",
      name: "Meal delivery — first order",
      description: "Order once from the app. The order is yours to keep.",
      category: "SIGNUP",
      countries: ["GB", "US"],
      devices: ["android", "ios"],
      advertiserPays: new Prisma.Decimal("28.0000"),
      userPays: new Prisma.Decimal("18.0000"),
      requiresPurchase: true,
      purchaseAmount: new Prisma.Decimal("15.00"),
      deadlineDays: 7,
      tiers: {
        create: [{ sequence: 1, label: "First order placed", userPays: new Prisma.Decimal("18.00"), starts: 310, completions: 214 }],
      },
    },
  });

  // A member whose session the screenshot uses. Matched on the email, because
  // that is the account's identity — looking it up by handle meant that on a
  // database where prisma/seed.ts had already made ada_w with this address, the
  // script tried to create a second account with the same email and died on the
  // unique index, halfway through, having already deleted every offer.
  const user = await prisma.user.upsert({
    where: { email: "ada@example.com" },
    update: { handle: "ada", countryCode: "GB", riskTier: "STANDARD", suspendedAt: null },
    create: {
      email: "ada@example.com", handle: "ada", countryCode: "GB",
      referralCode: "ADADEMO1", unsubscribeToken: randomUUID(), riskTier: "STANDARD",
    },
  });

  await prisma.session.deleteMany({ where: { sessionToken: "demo-shot-session" } });
  await prisma.session.create({
    data: { sessionToken: "demo-shot-session", userId: user.id, expires: new Date(Date.now() + 86_400_000) },
  });

  await prisma.reward.deleteMany({ where: { userId: user.id } });
  await prisma.reward.createMany({
    data: [
      { userId: user.id, network: "TOROX", networkTxnId: "d1", amount: new Prisma.Decimal("14.20"), advertiserPaid: new Prisma.Decimal("21.80"), status: "AVAILABLE", countryCode: "GB", rawPayload: {} },
      { userId: user.id, network: "CPX", networkTxnId: "d2", amount: new Prisma.Decimal("1.85"), advertiserPaid: new Prisma.Decimal("2.90"), status: "AVAILABLE", countryCode: "GB", rawPayload: {} },
      { userId: user.id, network: "LOOTABLY", networkTxnId: "d3", amount: new Prisma.Decimal("18.00"), advertiserPaid: new Prisma.Decimal("28.00"), status: "PENDING", availableAt: new Date(Date.now() + 18 * 3600_000), countryCode: "GB", rawPayload: {} },
    ],
  });

  console.log("seeded");
}
main().finally(() => prisma.$disconnect());
