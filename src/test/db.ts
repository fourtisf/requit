import { prisma } from "@/lib/prisma";

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
  "User",
] as const;

export async function resetDatabase(): Promise<void> {
  const list = TABLES.map((table) => `"public"."${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export { prisma };
