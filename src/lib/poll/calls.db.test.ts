import { beforeEach, describe, expect, it } from "vitest";
import { callBoard, callsOf, recordOf, weekStanding, yesterdayFor } from "@/lib/poll/calls";
import { recordAnswer, todaysQuestion } from "@/lib/poll/board";
import { currentWeek } from "@/lib/leaderboard";
import { makeUser, resetDatabase } from "@/test/db";

/**
 * The call against a real database.
 *
 * The rule worth proving is the one that makes the game fair: a day is scored
 * only once it is over. Everything else follows from it — a call made today
 * cannot be graded today, and a call made yesterday cannot be changed now.
 */

beforeEach(async () => {
  await resetDatabase();
});

let seq = 0;
async function member() {
  seq += 1;
  return makeUser({ email: `c${seq}@example.com`, handle: `caller${seq}` });
}

// Two days inside one week, so currentWeek() holds both.
const MONDAY = new Date("2026-09-07T10:00:00.000Z");
const TUESDAY = new Date("2026-09-08T10:00:00.000Z");
const WEDNESDAY = new Date("2026-09-09T10:00:00.000Z");

function options(at: Date): string[] {
  return todaysQuestion(at).question.options.map((option) => option.id);
}

describe("scoring a call", () => {
  it("leaves today's call unsettled, because the crowd is still arriving", async () => {
    const ada = await member();
    const [first] = options(MONDAY);
    await recordAnswer(ada.id, first!, first!, MONDAY);

    const calls = await callsOf(ada.id, MONDAY);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.correct).toBeNull();
    expect(await recordOf(ada.id, MONDAY)).toEqual({ right: 0, settled: 0, open: 1 });
  });

  it("scores it once the day is over", async () => {
    const [ada, bob, cal] = [await member(), await member(), await member()];
    const [first, second] = options(MONDAY);

    // Two answers for the first option, one for the second: the first wins.
    await recordAnswer(ada.id, first!, first!, MONDAY);
    await recordAnswer(bob.id, first!, second!, MONDAY);
    await recordAnswer(cal.id, second!, second!, MONDAY);

    expect(await recordOf(ada.id, TUESDAY)).toEqual({ right: 1, settled: 1, open: 0 });
    expect(await recordOf(bob.id, TUESDAY)).toEqual({ right: 0, settled: 1, open: 0 });
    expect(await recordOf(cal.id, TUESDAY)).toEqual({ right: 0, settled: 1, open: 0 });
  });

  it("pays a tie to everyone who called either side of it", async () => {
    const [ada, bob] = [await member(), await member()];
    const [first, second] = options(MONDAY);

    await recordAnswer(ada.id, first!, first!, MONDAY);
    await recordAnswer(bob.id, second!, second!, MONDAY);

    expect((await recordOf(ada.id, TUESDAY)).right).toBe(1);
    expect((await recordOf(bob.id, TUESDAY)).right).toBe(1);
  });

  it("keeps yesterday's score fixed once the day has closed", async () => {
    const [ada, bob] = [await member(), await member()];
    const [first, second] = options(MONDAY);
    await recordAnswer(ada.id, first!, first!, MONDAY);
    await recordAnswer(bob.id, first!, first!, MONDAY);

    const before = await recordOf(ada.id, TUESDAY);
    // Somebody answers on Tuesday. Monday's result is not theirs to move.
    const cal = await member();
    await recordAnswer(cal.id, options(TUESDAY)[1]!, options(TUESDAY)[1]!, TUESDAY);

    expect(await recordOf(ada.id, WEDNESDAY)).toMatchObject({ right: before.right });
    expect(second).toBeDefined();
  });
});

describe("yesterday's result", () => {
  it("is nothing for a member who did not answer yesterday", async () => {
    const ada = await member();
    expect(await yesterdayFor(ada.id, TUESDAY)).toBeNull();
  });

  it("names what won, by how much, and whether the member called it", async () => {
    const [ada, bob] = [await member(), await member()];
    const [first, second] = options(MONDAY);
    await recordAnswer(ada.id, first!, first!, MONDAY);
    await recordAnswer(bob.id, first!, second!, MONDAY);

    const ours = await yesterdayFor(ada.id, TUESDAY);
    expect(ours?.day).toBe("2026-09-07");
    expect(ours?.share).toBe(1);
    expect(ours?.called?.correct).toBe(true);

    const theirs = await yesterdayFor(bob.id, TUESDAY);
    expect(theirs?.called?.correct).toBe(false);
  });
});

describe("the week's board", () => {
  it("is empty before any day has closed", async () => {
    const ada = await member();
    await recordAnswer(ada.id, options(MONDAY)[0]!, options(MONDAY)[0]!, MONDAY);
    expect(await callBoard(currentWeek(MONDAY), 10, MONDAY)).toEqual([]);
  });

  it("ranks by calls read right", async () => {
    const [ada, bob] = [await member(), await member()];

    for (const day of [MONDAY, TUESDAY]) {
      const [first, second] = options(day);
      // Ada calls with the crowd both days; Bob calls against it.
      await recordAnswer(ada.id, first!, first!, day);
      await recordAnswer(bob.id, first!, second!, day);
    }

    const board = await callBoard(currentWeek(MONDAY), 10, WEDNESDAY);
    expect(board).toHaveLength(2);
    expect(board[0]).toMatchObject({ rank: 1, handle: ada.handle, right: 2, settled: 2 });
    expect(board[1]).toMatchObject({ rank: 2, handle: bob.handle, right: 0, settled: 2 });
  });

  it("puts the tighter record first when two members are level", async () => {
    const [ada, bob] = [await member(), await member()];
    const monday = options(MONDAY);
    const tuesday = options(TUESDAY);

    // Both read Monday right. Bob also called Tuesday, and missed.
    await recordAnswer(ada.id, monday[0]!, monday[0]!, MONDAY);
    await recordAnswer(bob.id, monday[0]!, monday[0]!, MONDAY);
    await recordAnswer(bob.id, tuesday[0]!, tuesday[1]!, TUESDAY);

    const board = await callBoard(currentWeek(MONDAY), 10, WEDNESDAY);
    expect(board.map((row) => row.handle)).toEqual([ada.handle, bob.handle]);
  });

  it("hides the handle of a member who keeps it off public tables", async () => {
    seq += 1;
    const quiet = await makeUser({
      email: `q${seq}@example.com`,
      handle: `quiet${seq}`,
      publicPayouts: false,
    });
    const [first] = options(MONDAY);
    await recordAnswer(quiet.id, first!, first!, MONDAY);

    const board = await callBoard(currentWeek(MONDAY), 10, TUESDAY);
    expect(board[0]?.handle).toBeNull();
    expect(board[0]?.right).toBe(1);
  });
});

describe("where a member stands", () => {
  it("is nothing for somebody who has not called a settled day", async () => {
    const ada = await member();
    expect(await weekStanding(ada.id, currentWeek(MONDAY), TUESDAY)).toBeNull();
  });

  it("is their real position, not 'outside the top ten'", async () => {
    const [ada, bob, cal] = [await member(), await member(), await member()];
    const monday = options(MONDAY);
    const tuesday = options(TUESDAY);

    // Monday: everyone answers the first option, so calling it was right.
    for (const person of [ada, bob, cal]) {
      await recordAnswer(person.id, monday[0]!, monday[0]!, MONDAY);
    }
    // Tuesday: ada and bob read it, cal does not call at all.
    await recordAnswer(ada.id, tuesday[0]!, tuesday[0]!, TUESDAY);
    await recordAnswer(bob.id, tuesday[0]!, tuesday[0]!, TUESDAY);

    const theirs = await weekStanding(cal.id, currentWeek(MONDAY), WEDNESDAY);
    expect(theirs).toMatchObject({ rank: 3, right: 1, settled: 1, of: 3 });
  });
});
