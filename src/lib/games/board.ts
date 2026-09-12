import { prisma } from "@/lib/prisma";
import { type GameSlug } from "@/lib/games/catalog";
import { type LeaderboardWindow } from "@/lib/leaderboard";

/**
 * High scores, per game.
 *
 * The table has been ready for this since the first game shipped — the index on
 * [game, score] exists for exactly this query and nothing else was using it.
 * What it adds is the answer to a fair question: what is a score *for*. Until
 * now it was a number on your own screen. Now it is a position, which is the
 * only thing a score can honestly be while no advertiser is paying for one.
 *
 * Two rules it inherits from the rewards leaderboard, deliberately:
 *
 * - One row per player, not per round. A board of rounds is a board one person
 *   fills on a good afternoon, and nobody else comes back to it.
 * - `publicPayouts = false` hides the handle, never the row. Removing the row
 *   would shift everyone else's rank and make the board wrong; withholding the
 *   name is what the member actually asked for.
 */

export type ScoreRow = {
  rank: number;
  /** Null when the member has turned their handle off in settings. */
  handle: string | null;
  countryCode: string;
  score: number;
  at: Date;
};

export type Standing = {
  best: number;
  /** Null when this player has not finished a round in the window. */
  rank: number | null;
};

function within(game: GameSlug, window: LeaderboardWindow | null) {
  return {
    game,
    endedAt: window
      ? { not: null, gte: window.start, lt: window.end }
      : { not: null },
  } as const;
}

export async function topScores(
  game: GameSlug,
  window: LeaderboardWindow | null,
  limit = 10,
): Promise<ScoreRow[]> {
  const grouped = await prisma.gameSession.groupBy({
    by: ["userId"],
    where: within(game, window),
    _max: { score: true, endedAt: true },
    orderBy: { _max: { score: "desc" } },
    take: limit,
  });

  const played = grouped.filter((row) => (row._max.score ?? 0) > 0);
  if (played.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: played.map((row) => row.userId) } },
    select: { id: true, handle: true, countryCode: true, publicPayouts: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  return played.map((row, index) => {
    const user = byId.get(row.userId);
    return {
      rank: index + 1,
      handle: user?.publicPayouts ? user.handle : null,
      countryCode: user?.countryCode ?? "XX",
      score: row._max.score ?? 0,
      at: row._max.endedAt ?? new Date(0),
    };
  });
}

/**
 * Where one player stands, whether or not they are on the visible page of it.
 *
 * The rank is counted by asking how many players are ahead rather than by
 * reading a position out of the top ten: a player at 340th has to be told 340th,
 * or the number is a lie for everyone outside the top ten — which is nearly
 * everyone.
 */
export async function standing(
  userId: string,
  game: GameSlug,
  window: LeaderboardWindow | null,
): Promise<Standing> {
  const mine = await prisma.gameSession.aggregate({
    where: { ...within(game, window), userId },
    _max: { score: true },
  });

  const best = mine._max.score ?? 0;
  if (best <= 0) return { best: 0, rank: null };

  // One row per player ahead. At this scale that is a small result set; if the
  // table ever grows into millions of rounds this becomes a counted subquery.
  const ahead = await prisma.gameSession.groupBy({
    by: ["userId"],
    where: within(game, window),
    _max: { score: true },
    having: { score: { _max: { gt: best } } },
  });

  return { best, rank: ahead.length + 1 };
}
