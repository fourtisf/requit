import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { applyPostback, holdUntil, parsePostback } from "@/lib/networks/postback";
import { balanceOf } from "@/lib/balance";
import { makeUser, prisma, resetDatabase } from "@/test/db";

const CREDIT = {
  user_id: "",
  oid: "txn-1",
  payout: "12.5000",
  revenue: "19.2000",
  offer_id: "trx-4001",
  offer_name: "Town hall 8",
  status: "1",
};

beforeEach(async () => {
  await resetDatabase();
});

async function member(overrides: Record<string, unknown> = {}) {
  return makeUser({ email: "ada@example.com", handle: "ada", countryCode: "GB", ...overrides });
}

async function offerWithTiers() {
  return prisma.offer.create({
    data: {
      network: "TOROX",
      networkOfferId: "trx-4001",
      name: "Kingdom builder",
      category: "GAME",
      countries: ["GB"],
      devices: ["android"],
      advertiserPays: new Prisma.Decimal("186.0000"),
      userPays: new Prisma.Decimal("120.9000"),
      tiers: {
        create: [
          { sequence: 1, label: "Town hall 4", userPays: new Prisma.Decimal("2.6000") },
          { sequence: 2, label: "Town hall 8", userPays: new Prisma.Decimal("27.3000") },
        ],
      },
    },
    select: { id: true },
  });
}

function parse(params: Record<string, string>) {
  const result = parsePostback("TOROX", params);
  if (typeof result === "string") throw new Error(`parse failed: ${result}`);
  return result;
}

describe("a valid credit", () => {
  it("creates exactly one reward, pending, with a hold", async () => {
    const user = await member();
    const outcome = await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id }), {});

    expect(outcome.kind).toBe("credited");
    const reward = await prisma.reward.findFirstOrThrow({ where: { userId: user.id } });
    expect(reward.status).toBe("PENDING");
    expect(reward.amount.toString()).toBe("12.5");
    expect(reward.advertiserPaid.toString()).toBe("19.2");
    // NEW holds 72 hours (§6.1).
    expect(reward.availableAt).not.toBeNull();
  });

  it("gives a TRUSTED member no hold at all", async () => {
    const user = await member({ riskTier: "TRUSTED" });
    await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id }), {});

    const reward = await prisma.reward.findFirstOrThrow({ where: { userId: user.id } });
    expect(reward.availableAt).toBeNull();
  });

  it("counts the tier completion, which is the completion-rate numerator", async () => {
    const user = await member();
    await offerWithTiers();
    await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id }), {});

    const tier = await prisma.offerTier.findFirstOrThrow({ where: { label: "Town hall 8" } });
    expect(tier.completions).toBe(1);
    // The other tier is untouched — a completion counts once, for one tier.
    const other = await prisma.offerTier.findFirstOrThrow({ where: { label: "Town hall 4" } });
    expect(other.completions).toBe(0);
  });

  it("links the reward to the offer when we know it", async () => {
    const user = await member();
    const offer = await offerWithTiers();
    await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id }), {});

    const reward = await prisma.reward.findFirstOrThrow({ where: { userId: user.id } });
    expect(reward.offerId).toBe(offer.id);
  });

  it("refuses a postback naming a member who does not exist", async () => {
    const outcome = await applyPostback("TOROX", parse({ ...CREDIT, user_id: "nobody" }), {});
    expect(outcome.kind).toBe("user-not-found");
    expect(await prisma.reward.count()).toBe(0);
  });
});

describe("a replayed postback", () => {
  it("credits zero additional rewards", async () => {
    // §11 step 5 names this case. Networks retry on non-200, so the same
    // transaction id arrives more than once as a matter of course.
    const user = await member();
    const params = parse({ ...CREDIT, user_id: user.id });

    const first = await applyPostback("TOROX", params, {});
    const second = await applyPostback("TOROX", params, {});
    const third = await applyPostback("TOROX", params, {});

    expect(first.kind).toBe("credited");
    expect(second.kind).toBe("duplicate");
    expect(third.kind).toBe("duplicate");
    expect(await prisma.reward.count()).toBe(1);
  });

  it("does not double-count the tier completion", async () => {
    const user = await member();
    await offerWithTiers();
    const params = parse({ ...CREDIT, user_id: user.id });

    await applyPostback("TOROX", params, {});
    await applyPostback("TOROX", params, {});

    const tier = await prisma.offerTier.findFirstOrThrow({ where: { label: "Town hall 8" } });
    expect(tier.completions).toBe(1);
  });
});

describe("a reversal", () => {
  it("reverses a pending reward and leaves the member alone", async () => {
    const user = await member();
    const params = parse({ ...CREDIT, user_id: user.id });
    await applyPostback("TOROX", params, {});

    const outcome = await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id, status: "2" }), {});

    expect(outcome).toMatchObject({ kind: "reversed", afterWithdrawal: false });
    const reward = await prisma.reward.findFirstOrThrow({ where: { userId: user.id } });
    expect(reward.status).toBe("REVERSED");
    expect(reward.reversedAt).not.toBeNull();

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.riskTier).toBe("NEW");
  });

  it("flags the member when the reward was already available", async () => {
    const user = await member();
    await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id }), {});
    await prisma.reward.updateMany({ where: { userId: user.id }, data: { status: "AVAILABLE" } });

    const outcome = await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id, status: "2" }), {});

    expect(outcome).toMatchObject({ kind: "reversed", afterWithdrawal: true });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.riskTier).toBe("FLAGGED");
  });

  it("never leaves a member with a negative balance", async () => {
    // §4.2: "do NOT create a negative balance the user can never clear."
    const user = await member();
    await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id }), {});
    await prisma.reward.updateMany({ where: { userId: user.id }, data: { status: "AVAILABLE" } });

    const wallet = await prisma.wallet.create({
      data: { userId: user.id, chain: "SOLANA", address: "9xQeWvG816bUx9EPa2rP1kQ4nJ8oTvBcYqk3ZmHt1" },
    });
    await prisma.withdrawal.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        chain: "SOLANA",
        amount: new Prisma.Decimal("12.5000"),
        idempotencyKey: "k1",
        status: "SETTLED",
      },
    });

    await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id, status: "2" }), {});

    const balance = await balanceOf(user.id);
    expect(balance.available.toString()).toBe("0");
    // The loss is surfaced as ours rather than hidden as their debt.
    expect(balance.shortfall.toString()).toBe("12.5");
  });

  it("ignores a reversal for a transaction we never credited", async () => {
    await member();
    const outcome = await applyPostback("TOROX", parse({ ...CREDIT, user_id: "x", status: "2" }), {});
    expect(outcome.kind).toBe("user-not-found");
    expect(await prisma.reward.count()).toBe(0);
  });

  it("is idempotent — a replayed reversal changes nothing", async () => {
    const user = await member();
    await applyPostback("TOROX", parse({ ...CREDIT, user_id: user.id }), {});
    const reversal = parse({ ...CREDIT, user_id: user.id, status: "2" });

    await applyPostback("TOROX", reversal, {});
    const again = await applyPostback("TOROX", reversal, {});
    expect(again.kind).toBe("duplicate");
  });
});

describe("holdUntil", () => {
  it("follows §6.1", () => {
    const now = new Date("2026-09-11T00:00:00Z");
    expect(holdUntil("NEW", now)?.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(holdUntil("STANDARD", now)?.toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(holdUntil("TRUSTED", now)).toBeNull();
  });
});
