import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { UNKNOWN_COUNTRY } from "@/lib/country";

/**
 * "Tell me when there are tasks here."
 *
 * The dead end this replaces: a member signs up, opens the task list, reads
 * "nothing live yet", and leaves with no reason to return and no way for us to
 * reach them when that changes.
 *
 * The same rows are the demand evidence §4.3's approval problem needs — a
 * network asks for proof of traffic before approving a publisher, and a count
 * per country is proof that can be collected before there is any inventory to
 * send people to.
 */

export type RegisterFailure = "unknown-country" | "suspended" | "already-live";

export type RegisterResult =
  | { ok: true; alreadyWaiting: boolean; waiting: number }
  | { ok: false; reason: RegisterFailure };

export async function registerInterest(input: {
  userId: string;
  countryCode: string;
}): Promise<RegisterResult> {
  const country = input.countryCode.toUpperCase();
  if (country === UNKNOWN_COUNTRY || !/^[A-Z]{2}$/.test(country)) {
    return { ok: false, reason: "unknown-country" };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { suspendedAt: true },
  });
  if (!user || user.suspendedAt) return { ok: false, reason: "suspended" };

  // Offering to notify someone about tasks that already exist would be a
  // promise we have already kept, and the mail would read as nonsense.
  const live = await prisma.offer.count({
    where: { isActive: true, countries: { has: country } },
  });
  if (live > 0) return { ok: false, reason: "already-live" };

  const existing = await prisma.countryInterest.findUnique({
    where: { userId_countryCode: { userId: input.userId, countryCode: country } },
    select: { id: true },
  });

  if (!existing) {
    try {
      await prisma.countryInterest.create({
        data: { userId: input.userId, countryCode: country },
      });
    } catch (error) {
      // Two clicks racing. The second one is the same ask, not an error.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        throw error;
      }
    }
  }

  return {
    ok: true,
    alreadyWaiting: existing !== null,
    waiting: await waitingIn(country),
  };
}

/** How many people are waiting for a country. Shown publicly, so it is a count of rows. */
export async function waitingIn(countryCode: string): Promise<number> {
  const country = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return 0;

  return prisma.countryInterest.count({ where: { countryCode: country } });
}

export async function isWaiting(userId: string, countryCode: string): Promise<boolean> {
  const country = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return false;

  const row = await prisma.countryInterest.findUnique({
    where: { userId_countryCode: { userId, countryCode: country } },
    select: { id: true },
  });
  return row !== null;
}

export type Demand = { countryCode: string; waiting: number; notified: number };

/** The operator view, and the table to put in front of a network. */
export async function demandByCountry(): Promise<Demand[]> {
  const rows = await prisma.countryInterest.groupBy({
    by: ["countryCode"],
    _count: { _all: true },
  });

  const notified = await prisma.countryInterest.groupBy({
    by: ["countryCode"],
    where: { notifiedAt: { not: null } },
    _count: { _all: true },
  });
  const notifiedBy = new Map(notified.map((row) => [row.countryCode, row._count._all]));

  return rows
    .map((row) => ({
      countryCode: row.countryCode,
      waiting: row._count._all - (notifiedBy.get(row.countryCode) ?? 0),
      notified: notifiedBy.get(row.countryCode) ?? 0,
    }))
    .sort((a, b) => b.waiting - a.waiting || a.countryCode.localeCompare(b.countryCode));
}

/** How many are told per run, so one newly-live country cannot flood the mail queue. */
export const NOTIFY_BATCH = 200;

/**
 * Tells people their country went live.
 *
 * `notifiedAt` is stamped before the mail is attempted, not after. A stamp
 * written afterwards means a crash mid-batch re-notifies everyone already told
 * on the next run, and being mailed the same announcement four times is how an
 * address marks a sender as spam.
 */
export async function notifyLiveCountries(): Promise<{ notified: number }> {
  const countries = await prisma.offer.findMany({
    where: { isActive: true },
    select: { countries: true },
  });
  const live = new Set(countries.flatMap((offer) => offer.countries));
  if (live.size === 0) return { notified: 0 };

  const waiting = await prisma.countryInterest.findMany({
    where: { countryCode: { in: [...live] }, notifiedAt: null },
    take: NOTIFY_BATCH,
    select: { id: true, userId: true, countryCode: true },
  });
  if (waiting.length === 0) return { notified: 0 };

  await prisma.countryInterest.updateMany({
    where: { id: { in: waiting.map((row) => row.id) } },
    data: { notifiedAt: new Date() },
  });

  for (const row of waiting) {
    void notify({
      userId: row.userId,
      kind: "reward",
      subject: "Tasks are live where you are",
      body: `There are tasks available in ${row.countryCode}. The reward, the odds of reaching each tier, and any purchase required are on the task page before you start.`,
    }).catch(() => undefined);
  }

  return { notified: waiting.length };
}
