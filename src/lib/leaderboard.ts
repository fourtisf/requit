import { prisma } from "@/lib/prisma";

export type LeaderboardEntry = {
  rank: number;
  /** Null when the member has turned their handle off in settings. */
  handle: string | null;
  countryCode: string;
  completions: number;
  earned: string;
};

export type LeaderboardWindow = { start: Date; end: Date };

/**
 * Top workers by confirmed rewards in a window.
 *
 * The same computation HANDOFF.md §9 needs for the weekly distribution's "top 50
 * workers" — one query, so the public board and the payout can never disagree.
 *
 * Two rules it does not get to break:
 *
 * - Only AVAILABLE rewards count. PENDING may still reverse, and a board that
 *   ranks unconfirmed work would reorder itself when a chargeback lands.
 * - `publicPayouts = false` hides the handle, not the row. Removing the row
 *   would shift everyone else's rank and make the board wrong; withholding the
 *   name is what the member actually asked for.
 */
export async function leaderboard(
  window: LeaderboardWindow,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const grouped = await prisma.reward.groupBy({
    by: ["userId"],
    where: {
      status: "AVAILABLE",
      createdAt: { gte: window.start, lt: window.end },
    },
    _sum: { amount: true },
    _count: { _all: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((row) => row.userId) } },
    select: { id: true, handle: true, countryCode: true, publicPayouts: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  return grouped.map((row, index) => {
    const user = byId.get(row.userId);
    return {
      rank: index + 1,
      handle: user?.publicPayouts ? user.handle : null,
      countryCode: user?.countryCode ?? "XX",
      completions: row._count._all,
      earned: (row._sum.amount ?? 0).toString(),
    };
  });
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The Sunday-to-Sunday window §9 accrues against, in UTC.
 *
 * Everything is computed in UTC — §9 snapshots at Sunday 20:00 UTC, and a
 * boundary that moved with the server's timezone would put a member's rewards in
 * a different week than the distribution that pays for them.
 */
export function currentWeek(now = new Date()): LeaderboardWindow {
  // The most recent Sunday at 00:00, which is today when today is Sunday.
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  return { start, end: new Date(start.getTime() + WEEK_MS) };
}
