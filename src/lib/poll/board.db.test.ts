import { beforeEach, describe, expect, it } from "vitest";
import {
  answerOf,
  answeredDays,
  recentResults,
  recordAnswer,
  tallyFor,
  todaysQuestion,
} from "@/lib/poll/board";
import { questionFor } from "@/lib/poll/rotation";
import { makeUser, prisma, resetDatabase } from "@/test/db";

/**
 * The question of the day against a real database.
 *
 * What needs Postgres: the one-answer-per-day rule is a unique index, not a
 * check in a function, and the tally is a group-by. Neither is provable against
 * a mock, and both are the parts that decide whether the results can be
 * believed.
 */

beforeEach(async () => {
  await resetDatabase();
});

let seq = 0;
async function member() {
  seq += 1;
  return makeUser({ email: `p${seq}@example.com`, handle: `voter${seq}` });
}

const TODAY = new Date("2026-09-12T10:00:00.000Z");
const TOMORROW = new Date("2026-09-13T10:00:00.000Z");

function firstOption(at: Date): string {
  return todaysQuestion(at).question.options[0]!.id;
}

describe("answering", () => {
  it("records the answer, and the question it was an answer to", async () => {
    const ada = await member();
    const result = await recordAnswer(ada.id, firstOption(TODAY), TODAY);

    expect(result.status).toBe("recorded");

    const row = await prisma.pollAnswer.findFirst({ where: { userId: ada.id } });
    expect(row?.day).toBe("2026-09-12");
    expect(row?.questionId).toBe(questionFor("2026-09-12").id);
    expect(row?.optionId).toBe(firstOption(TODAY));
  });

  it("refuses an option the day's question does not offer", async () => {
    const ada = await member();
    expect(await recordAnswer(ada.id, "not-an-option", TODAY)).toEqual({
      status: "unknown-option",
    });
    expect(await prisma.pollAnswer.count()).toBe(0);
  });

  it("refuses an option from a different day's question", async () => {
    // The browser never names the question, so this is the shape an attempt to
    // answer yesterday's — after seeing its results — would arrive in.
    const ada = await member();
    const tomorrows = firstOption(TOMORROW);
    const todays = todaysQuestion(TODAY).question.options.map((option) => option.id);

    if (todays.includes(tomorrows)) return; // two questions sharing an option id
    expect((await recordAnswer(ada.id, tomorrows, TODAY)).status).toBe("unknown-option");
  });

  it("is final — a second answer does not change the first", async () => {
    const ada = await member();
    const question = todaysQuestion(TODAY).question;
    const [first, second] = [question.options[0]!.id, question.options[1]!.id];

    await recordAnswer(ada.id, first, TODAY);
    const again = await recordAnswer(ada.id, second, TODAY);

    expect(again.status).toBe("already");
    expect(again.status === "already" && again.answer.optionId).toBe(first);
    expect(await prisma.pollAnswer.count({ where: { userId: ada.id } })).toBe(1);
  });

  it("hands back the answer that stands, rather than an error", async () => {
    const ada = await member();
    const option = firstOption(TODAY);
    await recordAnswer(ada.id, option, TODAY);

    const again = await recordAnswer(ada.id, option, TODAY);
    expect(again.status === "already" && again.answer.optionId).toBe(option);
  });

  it("lets the same member answer again on the next day", async () => {
    const ada = await member();
    await recordAnswer(ada.id, firstOption(TODAY), TODAY);
    expect((await recordAnswer(ada.id, firstOption(TOMORROW), TOMORROW)).status).toBe("recorded");
    expect(await answeredDays(ada.id)).toBe(2);
  });

  it("knows whether a member has answered today", async () => {
    const ada = await member();
    expect(await answerOf(ada.id, "2026-09-12")).toBeNull();

    await recordAnswer(ada.id, firstOption(TODAY), TODAY);
    expect((await answerOf(ada.id, "2026-09-12"))?.optionId).toBe(firstOption(TODAY));
    // Yesterday stays empty: a day is a day, not "recently".
    expect(await answerOf(ada.id, "2026-09-11")).toBeNull();
  });
});

describe("the result", () => {
  it("is empty, with every option still listed, before anyone answers", async () => {
    const { day, question } = todaysQuestion(TODAY);
    const tally = await tallyFor(day, question);

    expect(tally.total).toBe(0);
    expect(tally.rows).toHaveLength(question.options.length);
    expect(tally.rows.every((row) => row.count === 0 && row.share === 0)).toBe(true);
  });

  it("counts what people chose and works out each share", async () => {
    const { day, question } = todaysQuestion(TODAY);
    const [first, second] = [question.options[0]!.id, question.options[1]!.id];

    for (const option of [first, first, first, second]) {
      const voter = await member();
      await recordAnswer(voter.id, option, TODAY);
    }

    const tally = await tallyFor(day, question);
    expect(tally.total).toBe(4);
    expect(tally.rows.find((row) => row.option.id === first)?.count).toBe(3);
    expect(tally.rows.find((row) => row.option.id === first)?.share).toBeCloseTo(0.75);
    expect(tally.rows.find((row) => row.option.id === second)?.share).toBeCloseTo(0.25);
  });

  it("keeps the options nobody picked, because that is half the answer", async () => {
    const { day, question } = todaysQuestion(TODAY);
    const ada = await member();
    await recordAnswer(ada.id, question.options[0]!.id, TODAY);

    const tally = await tallyFor(day, question);
    expect(tally.rows.map((row) => row.option.id)).toEqual(
      question.options.map((option) => option.id),
    );
  });

  it("counts one day only — yesterday's answers are not in today's result", async () => {
    const ada = await member();
    await recordAnswer(ada.id, firstOption(TODAY), TODAY);

    const tomorrow = todaysQuestion(TOMORROW);
    expect((await tallyFor(tomorrow.day, tomorrow.question)).total).toBe(0);
  });
});

describe("the operator's view", () => {
  it("is empty until somebody answers", async () => {
    expect(await recentResults(14, TODAY)).toEqual([]);
  });

  it("returns a day per day answered, newest first", async () => {
    const ada = await member();
    const bob = await member();
    await recordAnswer(ada.id, firstOption(TODAY), TODAY);
    await recordAnswer(bob.id, firstOption(TODAY), TODAY);
    await recordAnswer(ada.id, firstOption(TOMORROW), TOMORROW);

    const results = await recentResults(14, TOMORROW);
    expect(results.map((result) => result.day)).toEqual(["2026-09-13", "2026-09-12"]);
    expect(results[0]?.tally.total).toBe(1);
    expect(results[1]?.tally.total).toBe(2);
  });

  it("labels a day with the question its answers name", async () => {
    const ada = await member();
    await recordAnswer(ada.id, firstOption(TODAY), TODAY);

    const [result] = await recentResults(14, TODAY);
    expect(result?.question.id).toBe(questionFor("2026-09-12").id);
  });

  it("leaves out days nobody answered", async () => {
    const ada = await member();
    await recordAnswer(ada.id, firstOption(TODAY), TODAY);
    expect((await recentResults(14, TOMORROW)).map((result) => result.day)).toEqual(["2026-09-12"]);
  });

  it("does not reach back further than it was asked to", async () => {
    const ada = await member();
    await recordAnswer(ada.id, firstOption(TODAY), TODAY);
    const muchLater = new Date("2026-10-30T10:00:00.000Z");
    expect(await recentResults(14, muchLater)).toEqual([]);
  });
});
