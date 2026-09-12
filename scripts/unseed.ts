/**
 * Removes development seed data from a database that should not have it.
 *
 *   npx tsx scripts/unseed.ts          # says what it would remove
 *   npx tsx scripts/unseed.ts --yes    # removes it
 *
 * This exists because the alternative is a psql one-liner, and the psql
 * one-liner keeps failing in the same way: DATABASE_URL is not exported in that
 * shell, `"${DATABASE_URL%%\?*}"` expands to an empty string, psql falls back to
 * the local socket as the current user, and the error it prints — role "root"
 * does not exist — describes none of that. A script imports dotenv and connects
 * the way the app connects, so there is no string surgery to get wrong.
 *
 * What it considers seed data is narrow on purpose: the five @example.com
 * accounts the seed creates, and offers. Offers because every one of them is
 * invented and none has a tracking URL — but if a reward has ever been paid
 * against an offer, that offer is real to somebody and this refuses the whole
 * job rather than deciding which rows are precious.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** The accounts prisma/seed.ts creates. Kept in one shape: the email domain. */
const SEED_EMAIL = "%@example.com";

async function main(): Promise<void> {
  const confirmed = process.argv.includes("--yes");

  const seedAccounts = await prisma.user.findMany({
    where: { email: { endsWith: "@example.com" } },
    select: { id: true },
  });
  const ids = seedAccounts.map((account) => account.id);

  const [offers, tiers, realUsers, rewards, withdrawals, disputes, referred] = await Promise.all([
    prisma.offer.count(),
    prisma.offerTier.count(),
    prisma.user.count({ where: { NOT: { email: { endsWith: "@example.com" } } } }),
    prisma.reward.count(),
    prisma.withdrawal.count({ where: { userId: { in: ids } } }),
    prisma.dispute.count({ where: { userId: { in: ids } } }),
    prisma.user.count({ where: { referredById: { in: ids } } }),
  ]);

  console.log(`\n  offers          ${offers}`);
  console.log(`  offer tiers     ${tiers}`);
  console.log(`  seed accounts   ${ids.length}  (${SEED_EMAIL})`);
  console.log(`  real accounts   ${realUsers}  (untouched)\n`);

  // Any of these means the rows are not seed data any more, and deciding which
  // of them is precious is not a script's call to make.
  const refusals: string[] = [];
  if (rewards > 0) refusals.push(`${rewards} reward rows exist`);
  if (withdrawals > 0) refusals.push(`a seed account has ${withdrawals} withdrawals`);
  if (disputes > 0) refusals.push(`a seed account has ${disputes} disputes`);
  if (referred > 0) refusals.push(`${referred} accounts were referred by a seed account`);

  if (refusals.length > 0) {
    console.error(`  Refusing: ${refusals.join(", ")}. Nothing was removed.\n`);
    process.exitCode = 1;
    return;
  }

  if (offers === 0 && tiers === 0 && ids.length === 0) {
    console.log("  Nothing to remove. This database is already clean.\n");
    return;
  }

  if (!confirmed) {
    console.log("  Dry run. Nothing was removed.\n  Run it again with --yes to remove them.\n");
    return;
  }

  // One transaction, because the first version of this deleted the offers and
  // then failed on a foreign key from a wallet — leaving a database that was
  // half cleaned and a person who had to work out which half.
  //
  // Wallets and devices are deleted explicitly: their relations deliberately do
  // NOT cascade from a user, so that removing a member can never quietly take
  // a payout address with it.
  const [removedTiers, removedOffers, , , removedUsers] = await prisma.$transaction([
    prisma.offerTier.deleteMany({}),
    prisma.offer.deleteMany({}),
    prisma.wallet.deleteMany({ where: { userId: { in: ids } } }),
    prisma.device.deleteMany({ where: { userId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);

  console.log(
    `  Removed ${removedOffers.count} offers, ${removedTiers.count} tiers, ` +
      `${removedUsers.count} seed accounts.\n`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
