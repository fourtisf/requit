import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { currentWeek, leaderboard } from "@/lib/leaderboard";
import { makeUser, prisma, resetDatabase } from "@/test/db";

const week = currentWeek();
const insideWindow = new Date(week.start.getTime() + 60 * 60 * 1000);

let txn = 0;

async function reward(
  userId: string,
  amount: string,
  overrides: { status?: "PENDING" | "AVAILABLE" | "REVERSED"; createdAt?: Date } = {},
) {
  txn += 1;
  return prisma.reward.create({
    data: {
      userId,
      network: "TOROX",
      networkTxnId: `txn-${txn}`,
      amount: new Prisma.Decimal(amount),
      advertiserPaid: new Prisma.Decimal(amount),
      countryCode: "GB",
      rawPayload: {},
      status: overrides.status ?? "AVAILABLE",
      createdAt: overrides.createdAt ?? insideWindow,
    },
  });
}

beforeEach(async () => {
  await resetDatabase();
  txn = 0;
});

describe("leaderboard", () => {
  it("is empty rather than fabricated when nobody has earned", async () => {
    expect(await leaderboard(week)).toEqual([]);
  });

  it("ranks by confirmed earnings, highest first", async () => {
    const ada = await makeUser({ email: "ada@example.com", handle: "ada" });
    const reid = await makeUser({ email: "reid@example.com", handle: "reid" });

    await reward(ada.id, "10.0000");
    await reward(reid.id, "40.0000");

    const rows = await leaderboard(week);
    expect(rows.map((r) => [r.rank, r.handle])).toEqual([
      [1, "reid"],
      [2, "ada"],
    ]);
  });

  it("counts only AVAILABLE rewards", async () => {
    // PENDING can still reverse. A board that ranked unconfirmed work would
    // reorder itself when a chargeback landed.
    const ada = await makeUser({ email: "ada@example.com", handle: "ada" });
    await reward(ada.id, "10.0000", { status: "AVAILABLE" });
    await reward(ada.id, "90.0000", { status: "PENDING" });
    await reward(ada.id, "90.0000", { status: "REVERSED" });

    const rows = await leaderboard(week);
    expect(rows[0]?.earned).toBe("10");
    expect(rows[0]?.completions).toBe(1);
  });

  it("ignores rewards from outside the window", async () => {
    const ada = await makeUser({ email: "ada@example.com", handle: "ada" });
    await reward(ada.id, "10.0000", {
      createdAt: new Date(week.start.getTime() - 60 * 60 * 1000),
    });

    expect(await leaderboard(week)).toEqual([]);
  });

  it("hides the handle of a member who opted out, but keeps their rank", async () => {
    // Dropping the row instead would shift everyone below them and make the
    // board wrong. Withholding the name is what the member actually asked for.
    const shy = await makeUser({
      email: "shy@example.com",
      handle: "shy",
      publicPayouts: false,
    });
    const loud = await makeUser({ email: "loud@example.com", handle: "loud" });

    await reward(shy.id, "50.0000");
    await reward(loud.id, "10.0000");

    const rows = await leaderboard(week);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rank: 1, handle: null });
    expect(rows[1]).toMatchObject({ rank: 2, handle: "loud" });
  });

  it("respects the limit", async () => {
    for (let i = 0; i < 4; i += 1) {
      const user = await makeUser({ email: `u${i}@example.com`, handle: `u${i}` });
      await reward(user.id, `${10 + i}.0000`);
    }

    expect(await leaderboard(week, 2)).toHaveLength(2);
  });
});
