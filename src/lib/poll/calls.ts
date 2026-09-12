import { prisma } from "@/lib/prisma";
import { dayOf } from "@/lib/games/daily";
import { currentWeek, type LeaderboardWindow } from "@/lib/leaderboard";
import { questionById } from "@/lib/poll/questions";

/**
 * The call — the part of the question that can be won.
 *
 * An opinion cannot be scored: there is no right answer to "what device are you
 * on", and inventing one would be the first fake number on a site whose whole
 * argument is that it has none. A guess about other people can be scored
 * exactly, because tomorrow the rows say what everybody actually chose.
 *
 * So the task keeps the same shape as the arcade. One round a day, the same
 * one for everybody. A move you make on it. A result the server works out from
 * rows rather than taking your browser's word for — the same rule as replaying
 * a game, arrived at from the other direction: here the thing that cannot be
 * faked is the crowd itself.
 *
 * And the timing does what a game's end-of-round does. The day closes at
 * midnight UTC; until then your call is made and unsettled, because the crowd
 * is still arriving. Nobody can call it after seeing the result, and there is a
 * reason to come back tomorrow that is not a prize.
 */

/**
 * The option (or options) most people picked.
 *
 * A tie counts for everyone who called any of the tied options: "most people
 * said X" is not true of a two-way split, and scoring it as though it were
 * would make the game turn on a coin flip nobody could have read.
 */
export function winnersOf(counts: { optionId: string; count: number }[]): string[] {
  const best = counts.reduce((top, row) => Math.max(top, row.count), 0);
  if (best === 0) return [];
  return counts.filter((row) => row.count === best).map((row) => row.optionId);
}

export type Call = {
  day: string;
  /** What the member called. */
  predicted: string;
  /** Null while the day is still open. */
  correct: boolean | null;
};

/** Days that are finished, so their tally cannot move any more. */
function settled(day: string, now: Date): boolean {
  return day < dayOf(now);
}

/**
 * Every call this member has made, newest first, scored where the day is over.
 *
 * Days are scored from the answers themselves rather than from a stored result:
 * a cached winner is a second copy of a fact, and the version that disagrees is
 * always the one somebody is looking at.
 */
export async function callsOf(userId: string, now: Date = new Date()): Promise<Call[]> {
  const mine = await prisma.pollAnswer.findMany({
    where: { userId, predictedOptionId: { not: null } },
    orderBy: { day: "desc" },
    select: { day: true, questionId: true, predictedOptionId: true },
  });
  if (mine.length === 0) return [];

  const winners = await winnersByDay(mine.map((row) => row.day), now);

  return mine.map((row) => {
    const won = winners.get(row.day);
    return {
      day: row.day,
      predicted: row.predictedOptionId!,
      correct: won === undefined ? null : won.includes(row.predictedOptionId!),
    };
  });
}

/** The winning options per day, for settled days only. */
async function winnersByDay(days: string[], now: Date): Promise<Map<string, string[]>> {
  const closed = [...new Set(days)].filter((day) => settled(day, now));
  if (closed.length === 0) return new Map();

  const grouped = await prisma.pollAnswer.groupBy({
    by: ["day", "optionId"],
    where: { day: { in: closed } },
    _count: { optionId: true },
  });

  const byDay = new Map<string, { optionId: string; count: number }[]>();
  for (const row of grouped) {
    const rows = byDay.get(row.day) ?? [];
    rows.push({ optionId: row.optionId, count: row._count.optionId });
    byDay.set(row.day, rows);
  }

  return new Map([...byDay].map(([day, rows]) => [day, winnersOf(rows)]));
}

export type Record_ = { right: number; settled: number; open: number };

/** How often this member has read the room, over every day they called. */
export async function recordOf(userId: string, now: Date = new Date()): Promise<Record_> {
  const calls = await callsOf(userId, now);
  return {
    right: calls.filter((call) => call.correct === true).length,
    settled: calls.filter((call) => call.correct !== null).length,
    open: calls.filter((call) => call.correct === null).length,
  };
}

export type CallerRow = {
  rank: number;
  /** Null when the member keeps their handle off public tables. */
  handle: string | null;
  right: number;
  settled: number;
};

/**
 * This week's board, ranked by calls read right.
 *
 * Ranked on the count rather than the percentage: a member who called once and
 * got it right is not ahead of one who called five days and got four, and a
 * percentage board says they are. Accuracy breaks ties, so among equal counts
 * the tighter record wins.
 *
 * The window is `currentWeek()` — the same Sunday-to-Sunday UTC week the game
 * boards and §9 use, rather than a third definition of a week.
 */
/** Everyone who called a settled day this week, best record first. */
async function rankedCallers(
  window: LeaderboardWindow,
  now: Date,
): Promise<{ userId: string; right: number; settled: number }[]> {
  const days: string[] = [];
  for (
    let cursor = new Date(window.start);
    cursor < window.end && cursor < now;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const day = dayOf(cursor);
    if (settled(day, now)) days.push(day);
  }
  if (days.length === 0) return [];

  const [answers, winners] = await Promise.all([
    prisma.pollAnswer.findMany({
      where: { day: { in: days }, predictedOptionId: { not: null } },
      select: { userId: true, day: true, predictedOptionId: true },
    }),
    winnersByDay(days, now),
  ]);

  const tally = new Map<string, { right: number; settled: number }>();
  for (const answer of answers) {
    const entry = tally.get(answer.userId) ?? { right: 0, settled: 0 };
    entry.settled += 1;
    if (winners.get(answer.day)?.includes(answer.predictedOptionId!)) entry.right += 1;
    tally.set(answer.userId, entry);
  }

  return [...tally.entries()]
    .map(([userId, entry]) => ({ userId, ...entry }))
    .sort(
      (a, b) =>
        b.right - a.right || b.right / b.settled - a.right / a.settled || a.settled - b.settled,
    );
}

/**
 * This week's board, ranked by calls read right.
 *
 * Ranked on the count rather than the percentage: a member who called once and
 * got it right is not ahead of one who called five days and got four, and a
 * percentage board says they are. Accuracy breaks ties, so among equal counts
 * the tighter record wins.
 *
 * The window is `currentWeek()` — the same Sunday-to-Sunday UTC week the game
 * boards and §9 use, rather than a third definition of a week.
 */
export async function callBoard(
  window: LeaderboardWindow = currentWeek(),
  limit = 10,
  now: Date = new Date(),
): Promise<CallerRow[]> {
  const ranked = (await rankedCallers(window, now)).slice(0, limit);
  if (ranked.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: ranked.map((row) => row.userId) } },
    select: { id: true, handle: true, publicPayouts: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));

  return ranked.map((row, index) => {
    const user = byId.get(row.userId);
    return {
      rank: index + 1,
      handle: user?.publicPayouts ? user.handle : null,
      right: row.right,
      settled: row.settled,
    };
  });
}

/**
 * Where this member stands, whether or not they are on the visible board.
 *
 * Told their real position rather than "not in the top ten", which is nearly
 * everyone and says nothing — the same rule the game boards follow.
 */
export async function weekStanding(
  userId: string,
  window: LeaderboardWindow = currentWeek(),
  now: Date = new Date(),
): Promise<{ rank: number; right: number; settled: number; of: number } | null> {
  const ranked = await rankedCallers(window, now);
  const index = ranked.findIndex((row) => row.userId === userId);
  if (index === -1) return null;

  const mine = ranked[index]!;
  return { rank: index + 1, right: mine.right, settled: mine.settled, of: ranked.length };
}

export type Yesterday = {
  day: string;
  ask: string;
  /** The winning option's label, or labels when the day tied. */
  won: string[];
  share: number;
  /** What this member called, and whether it came in. */
  called: { label: string; correct: boolean } | null;
};

/**
 * Yesterday's result, for the member who called it.
 *
 * This is the round ending. Without it a call is made into a void, and the one
 * honest reason to come back tomorrow — finding out whether you read the room —
 * never arrives.
 */
export async function yesterdayFor(userId: string, now: Date = new Date()): Promise<Yesterday | null> {
  const day = dayOf(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const mine = await prisma.pollAnswer.findUnique({
    where: { userId_day: { userId, day } },
    select: { questionId: true, predictedOptionId: true },
  });
  if (!mine) return null;

  const question = questionById(mine.questionId);
  if (!question) return null;

  const grouped = await prisma.pollAnswer.groupBy({
    by: ["optionId"],
    where: { day, questionId: mine.questionId },
    _count: { optionId: true },
  });
  const counts = grouped.map((row) => ({ optionId: row.optionId, count: row._count.optionId }));
  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const winners = winnersOf(counts);
  if (winners.length === 0 || total === 0) return null;

  const label = (id: string) =>
    question.options.find((option) => option.id === id)?.label ?? id;
  const top = counts.find((row) => row.optionId === winners[0])?.count ?? 0;

  return {
    day,
    ask: question.ask,
    won: winners.map(label),
    share: top / total,
    called: mine.predictedOptionId
      ? {
          label: label(mine.predictedOptionId),
          correct: winners.includes(mine.predictedOptionId),
        }
      : null,
  };
}
