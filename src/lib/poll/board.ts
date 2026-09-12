import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayOf } from "@/lib/games/daily";
import {
  optionById,
  questionById,
  type PollOption,
  type PollQuestion,
} from "@/lib/poll/questions";
import { questionFor } from "@/lib/poll/rotation";

/**
 * The day's question, the member's answer, and what everyone else said.
 *
 * Three rules, and all three are what make it worth opening:
 *
 *   1. Everyone is asked the same question on the same day.
 *   2. The results are hidden until you have answered. Seeing the counts first
 *      changes the answer, which would leave us with data about what people
 *      think other people think.
 *   3. An answer is final. Not to be strict — it is the only way the second
 *      rule means anything, since an editable answer is a look at the results
 *      followed by a correction.
 *
 * The day and the question are always derived here, never taken from the
 * browser: the same rule as the daily board's seed. A client that could name
 * the question it was answering could answer a question it liked better, or
 * answer yesterday's after seeing today's results.
 */

export type Today = { day: string; question: PollQuestion };

export function todaysQuestion(now: Date = new Date()): Today {
  const day = dayOf(now);
  return { day, question: questionFor(day) };
}

export type Answer = { optionId: string; at: Date };

export async function answerOf(userId: string, day: string): Promise<Answer | null> {
  const row = await prisma.pollAnswer.findUnique({
    where: { userId_day: { userId, day } },
    select: { optionId: true, createdAt: true },
  });
  return row ? { optionId: row.optionId, at: row.createdAt } : null;
}

export type Recorded =
  | { status: "recorded"; answer: Answer }
  /** Already answered today. Carries the existing answer rather than an error. */
  | { status: "already"; answer: Answer }
  | { status: "unknown-option" };

export async function recordAnswer(
  userId: string,
  optionId: string,
  now: Date = new Date(),
): Promise<Recorded> {
  const { day, question } = todaysQuestion(now);
  if (!optionById(question, optionId)) return { status: "unknown-option" };

  try {
    const row = await prisma.pollAnswer.create({
      data: { userId, day, questionId: question.id, optionId },
      select: { optionId: true, createdAt: true },
    });
    return { status: "recorded", answer: { optionId: row.optionId, at: row.createdAt } };
  } catch (error) {
    // The unique index is the arbiter, not a read-then-write in this function:
    // two tabs submitting at once would both pass a check and one would win.
    const clash =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (!clash) throw error;

    const existing = await answerOf(userId, day);
    return existing
      ? { status: "already", answer: existing }
      : // Only reachable if the row vanished between the clash and this read.
        { status: "unknown-option" };
  }
}

export type TallyRow = { option: PollOption; count: number; share: number };
export type Tally = { total: number; rows: TallyRow[] };

/**
 * What everyone said, in the question's own option order.
 *
 * Options with nobody on them are kept rather than dropped: a result that only
 * lists what was chosen hides the interesting half, which is what nobody chose.
 */
export async function tallyFor(day: string, question: PollQuestion): Promise<Tally> {
  const grouped = await prisma.pollAnswer.groupBy({
    by: ["optionId"],
    where: { day, questionId: question.id },
    _count: { optionId: true },
  });

  const counts = new Map(grouped.map((row) => [row.optionId, row._count.optionId]));
  const total = grouped.reduce((sum, row) => sum + row._count.optionId, 0);

  return {
    total,
    rows: question.options.map((option) => {
      const count = counts.get(option.id) ?? 0;
      return { option, count, share: total === 0 ? 0 : count / total };
    }),
  };
}

/**
 * How many days this member has answered, ever.
 *
 * A count of work done, not a streak. A streak rewards turning up, which
 * lib/readiness.ts refuses to do on purpose — and a broken one is a punishment
 * for a day off from something that does not pay.
 */
export async function answeredDays(userId: string): Promise<number> {
  return prisma.pollAnswer.count({ where: { userId } });
}

export type DayResult = { day: string; question: PollQuestion; tally: Tally };

/**
 * The last few days of answers, for the operator.
 *
 * Without this the card is a form with extra steps: it tells members their
 * answers decide things, and nobody here can read them. Days with no answers
 * are left out rather than listed empty — the site had no members on most of
 * them, and a page of zeroes buries the days that do say something.
 */
export async function recentResults(days = 14, now: Date = new Date()): Promise<DayResult[]> {
  const wanted = Array.from({ length: days }, (_unused, step) =>
    dayOf(new Date(now.getTime() - step * 24 * 60 * 60 * 1000)),
  );

  const answered = await prisma.pollAnswer.groupBy({
    by: ["day", "questionId", "optionId"],
    where: { day: { in: wanted } },
    _count: { optionId: true },
  });
  if (answered.length === 0) return [];

  const out: DayResult[] = [];
  for (const day of wanted) {
    const rows = answered.filter((row) => row.day === day);
    if (rows.length === 0) continue;

    // The question the ANSWERS name, not the one today's rotation would pick:
    // the bank can be reordered, and a result relabelled by a later edit is
    // worse than no result.
    const asked = questionById(rows[0]!.questionId);
    if (!asked) continue;

    const counts = new Map(rows.map((row) => [row.optionId, row._count.optionId]));
    const total = rows.reduce((sum, row) => sum + row._count.optionId, 0);
    out.push({
      day,
      question: asked,
      tally: {
        total,
        rows: asked.options.map((option) => {
          const count = counts.get(option.id) ?? 0;
          return { option, count, share: total === 0 ? 0 : count / total };
        }),
      },
    });
  }

  return out;
}
