import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { availability, publicStats, recentPayouts, sla } from "@/lib/public-stats";
import { advanceDispute, submitDispute } from "@/lib/disputes";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

async function member(handle: string, publicPayouts = true) {
  return makeUser({
    email: `${handle}@example.com`,
    handle,
    publicPayouts,
  });
}

async function settled(userId: string, amount: string, txHash: string, daysAgo = 1) {
  const wallet = await prisma.wallet.create({
    data: {
      userId,
      chain: "BASE",
      address: `0x${Math.random().toString(16).slice(2).padEnd(40, "0").slice(0, 40)}`,
      verifiedAt: new Date(),
    },
  });
  const at = new Date(Date.now() - daysAgo * 86_400_000);
  return prisma.withdrawal.create({
    data: {
      userId,
      walletId: wallet.id,
      chain: "BASE",
      amount: new Prisma.Decimal(amount),
      status: "SETTLED",
      txHash,
      settledAt: at,
      idempotencyKey: `key-${Math.random()}`,
    },
  });
}

describe("with no history at all", () => {
  it("reports absence rather than zeroes that look measured", async () => {
    expect(await recentPayouts()).toEqual([]);

    const response = await sla();
    // §8: "If a number cannot be computed yet, return null." A 0h first reply
    // would read as instant support rather than as no data.
    expect(response).toEqual({
      firstReplyHours: null,
      escalationHours: null,
      medianResolutionDays: null,
      paidRate: null,
      sampleSize: 0,
    });

    const country = await availability("GB");
    expect(country.offerCount).toBe(0);
    expect(country.qualifyRate).toBeNull();
    expect(country.bestRealisticTier).toBeNull();
    // The note is the one editorial field §8 allows, and inventing one would be
    // the same hardcoded figure in prose.
    expect(country.note).toBeNull();
  });
});

describe("public payouts", () => {
  it("withholds the handle of a member who opted out, but not the payment", async () => {
    const shown = await member("ada", true);
    const hidden = await member("bob", false);
    await settled(shown.id, "25.00", "0xaaa", 1);
    await settled(hidden.id, "40.00", "0xbbb", 2);

    const payouts = await recentPayouts();

    expect(payouts.map((payout) => payout.handle)).toEqual(["ada", null]);
    // The amount and the transaction stay: the name is theirs to withhold, the
    // payment is the evidence the page exists for.
    expect(payouts.map((payout) => payout.amount)).toEqual(["25.00", "40.00"]);
    expect(payouts.map((payout) => payout.txHash)).toEqual(["0xaaa", "0xbbb"]);
  });

  it("publishes the date but not the time", async () => {
    const user = await member("ada");
    await settled(user.id, "25.00", "0xaaa");

    const [payout] = await recentPayouts();
    // A precise timestamp beside a handle and a chain is enough to link someone
    // to an on-chain identity they did not choose to publish.
    expect(payout?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("shows only settled withdrawals, newest first", async () => {
    const user = await member("ada");
    await settled(user.id, "10.00", "0xold", 5);
    await settled(user.id, "20.00", "0xnew", 1);

    const wallet = await prisma.wallet.findFirstOrThrow();
    await prisma.withdrawal.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        chain: "BASE",
        amount: new Prisma.Decimal("99"),
        status: "SENDING",
        txHash: "0xpending",
        idempotencyKey: "pending",
      },
    });

    expect((await recentPayouts()).map((payout) => payout.txHash)).toEqual(["0xnew", "0xold"]);
  });
});

describe("public stats", () => {
  it("sums only settled money, and separates the last seven days", async () => {
    const user = await member("ada");
    await settled(user.id, "25.00", "0xa", 1);
    await settled(user.id, "40.00", "0xb", 3);
    await settled(user.id, "100.00", "0xc", 30);

    const stats = await publicStats();
    expect(stats.paidToDate).toBe("165.00");
    expect(stats.paidLast7d).toBe("65.00");
    expect(stats.withdrawalCount).toBe(3);
  });

  it("counts refusals we made, not failures the chain caused", async () => {
    const user = await member("ada");
    const wallet = await prisma.wallet.create({
      data: { userId: user.id, chain: "BASE", address: `0x${"9".repeat(40)}`, verifiedAt: new Date() },
    });
    // A chain failure. Not our decision, so it must not appear in the count.
    await prisma.withdrawal.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        chain: "BASE",
        amount: new Prisma.Decimal("10"),
        status: "FAILED",
        failureReason: "The transaction failed on chain. Your balance is unchanged.",
        idempotencyKey: "chain-failure",
      },
    });

    expect((await publicStats()).refusedCount).toBe(0);

    // An operator rejection. Ours, so it counts.
    await prisma.adminAction.create({
      data: {
        actorEmail: "ops@example.com",
        action: "reject-withdrawal",
        subjectId: "some-withdrawal",
        reason: "Wallet belongs to another member.",
      },
    });

    expect((await publicStats()).refusedCount).toBe(1);
  });
});

describe("SLA", () => {
  async function disputeAged(daysAgo: number) {
    const user = await makeUser({
      email: `d${Math.random()}@example.com`,
      handle: `h${Math.random().toString(36).slice(2, 10)}`,
    });
    const result = await submitDispute({
      userId: user.id,
      network: "TOROX",
      claimedAmount: new Prisma.Decimal("10"),
      reason: "A long enough reason to be accepted by the validator.",
      evidenceUrls: [],
    });
    if (!result.ok) throw new Error("setup failed");

    await prisma.dispute.update({
      where: { id: result.dispute.id },
      data: { createdAt: new Date(Date.now() - daysAgo * 86_400_000) },
    });
    return result.dispute.id;
  }

  it("reports the real medians, not a target", async () => {
    const a = await disputeAged(2);
    const b = await disputeAged(4);

    await advanceDispute({ disputeId: a, to: "ACKNOWLEDGED", note: "Looking." });
    await advanceDispute({ disputeId: a, to: "RESOLVED", note: "Paid.", outcome: "PAID" });
    await advanceDispute({ disputeId: b, to: "ACKNOWLEDGED", note: "Looking." });
    await advanceDispute({
      disputeId: b,
      to: "RESOLVED",
      note: "Refused.",
      outcome: "REJECTED_BY_ADVERTISER",
    });

    const response = await sla();
    expect(response.sampleSize).toBe(2);
    // Two days and four days, so a median of three.
    expect(response.medianResolutionDays).toBeCloseTo(3, 0);
    expect(response.paidRate).toBe(0.5);
  });

  it("ignores disputes older than ninety days", async () => {
    await disputeAged(100);
    expect((await sla()).sampleSize).toBe(0);
  });

  it("reports a paid rate only over disputes that actually closed", async () => {
    const closed = await disputeAged(1);
    await disputeAged(1); // still open

    await advanceDispute({ disputeId: closed, to: "RESOLVED", note: "Paid.", outcome: "PAID" });

    const response = await sla();
    expect(response.sampleSize).toBe(2);
    // One of one closed disputes was paid. Counting the open one as unpaid
    // would understate it and change as soon as it closed.
    expect(response.paidRate).toBe(1);
  });
});

describe("availability", () => {
  it("never reports a completion rate from a handful of samples", async () => {
    await prisma.offer.create({
      data: {
        network: "TOROX",
        networkOfferId: "o-1",
        name: "Kingdom builder",
        category: "GAME",
        countries: ["GB"],
        devices: ["android"],
        advertiserPays: new Prisma.Decimal("100"),
        userPays: new Prisma.Decimal("60"),
        tiers: {
          create: [{ sequence: 1, label: "Level 5", userPays: new Prisma.Decimal("6"), starts: 4, completions: 3 }],
        },
      },
    });

    const country = await availability("GB");
    expect(country.offerCount).toBe(1);
    // Three of four is 75%, and publishing that from four data points is the
    // sort of number that becomes a complaint.
    expect(country.qualifyRate).toBeNull();
    expect(country.bestRealisticTier).toBeNull();
  });

  it("reports a tier only once enough people have actually reached it", async () => {
    await prisma.offer.create({
      data: {
        network: "TOROX",
        networkOfferId: "o-2",
        name: "Kingdom builder",
        category: "GAME",
        countries: ["GB"],
        devices: ["android"],
        advertiserPays: new Prisma.Decimal("300"),
        userPays: new Prisma.Decimal("180"),
        tiers: {
          create: [
            { sequence: 1, label: "Level 5", userPays: new Prisma.Decimal("6"), starts: 500, completions: 200 },
            // The headline tier almost nobody finishes. Quoting it is exactly
            // the practice this product positions against.
            { sequence: 2, label: "Level 90", userPays: new Prisma.Decimal("174"), starts: 500, completions: 2 },
          ],
        },
      },
    });

    const country = await availability("GB");
    expect(country.bestRealisticTier).toEqual({ label: "Level 5", amount: "6.00" });
  });

  it("returns nothing for a country with no offers", async () => {
    const country = await availability("ZZ");
    expect(country.offerCount).toBe(0);
    expect(country.networksLive).toBe(0);
  });
});
