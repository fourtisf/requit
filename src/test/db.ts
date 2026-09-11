import { randomUUID } from "node:crypto";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/referral";

/**
 * Tables are truncated rather than dropped, so migrations run once per suite
 * instead of once per test. RESTART IDENTITY keeps sequences from drifting
 * across tests; CASCADE handles the foreign keys.
 */
const TABLES = [
  "Session",
  "Account",
  "VerificationToken",
  "Withdrawal",
  "Dispute",
  "Reward",
  "Device",
  "Wallet",
  "OfferTier",
  "Offer",
  "NetworkInvoice",
  "AdminAction",
  "User",
] as const;

export async function resetDatabase(): Promise<void> {
  const list = TABLES.map((table) => `"public"."${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export { prisma };

/**
 * A user with the columns every user must have, so a test only states what it
 * actually cares about. Kept here rather than in each test file: when a required
 * column is added, this is the one place that has to learn about it.
 */
export function makeUser(
  overrides: Partial<Prisma.UserCreateInput> & { email: string; handle: string },
): Promise<User> {
  return prisma.user.create({
    data: {
      countryCode: "GB",
      referralCode: generateReferralCode(),
      unsubscribeToken: randomUUID(),
      ...overrides,
    },
  });
}
