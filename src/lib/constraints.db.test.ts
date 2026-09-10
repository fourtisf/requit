import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma, resetDatabase } from "@/test/db";

/**
 * HANDOFF.md §13 turns on three unique constraints. They are not hints, and a
 * refactor that "cleans up" the schema must fail here rather than in production
 * with a drained hot wallet.
 */
const UNIQUE_VIOLATION = "P2002";

async function makeUser(email: string, handle: string) {
  return prisma.user.create({
    data: { email, handle, countryCode: "GB" },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Reward (network, networkTxnId)", () => {
  it("is what makes a replayed postback credit nothing", async () => {
    const user = await makeUser("ada@example.com", "ada");
    const reward = {
      userId: user.id,
      network: "TOROX" as const,
      networkTxnId: "txn-1",
      amount: new Prisma.Decimal("12.5000"),
      advertiserPaid: new Prisma.Decimal("19.2000"),
      countryCode: "GB",
      rawPayload: {},
    };

    await prisma.reward.create({ data: reward });

    await expect(prisma.reward.create({ data: reward })).rejects.toMatchObject({
      code: UNIQUE_VIOLATION,
    });
    expect(await prisma.reward.count()).toBe(1);
  });

  it("scopes the dedupe per network — two networks may reuse an id", async () => {
    const user = await makeUser("ada@example.com", "ada");
    const base = {
      userId: user.id,
      networkTxnId: "txn-1",
      amount: new Prisma.Decimal("1.0000"),
      advertiserPaid: new Prisma.Decimal("1.5000"),
      countryCode: "GB",
      rawPayload: {},
    };

    await prisma.reward.create({ data: { ...base, network: "TOROX" } });
    await prisma.reward.create({ data: { ...base, network: "CPX" } });

    expect(await prisma.reward.count()).toBe(2);
  });
});

describe("Wallet (chain, address)", () => {
  it("stops one wallet being attached to two accounts", async () => {
    const first = await makeUser("ada@example.com", "ada");
    const second = await makeUser("reid@example.com", "reid");
    const address = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

    await prisma.wallet.create({ data: { userId: first.id, chain: "BASE", address } });

    await expect(
      prisma.wallet.create({ data: { userId: second.id, chain: "BASE", address } }),
    ).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
  });

  it("treats the same string on two chains as two wallets", async () => {
    const user = await makeUser("ada@example.com", "ada");
    const address = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F";

    await prisma.wallet.create({ data: { userId: user.id, chain: "BASE", address } });
    await prisma.wallet.create({ data: { userId: user.id, chain: "SOLANA", address } });

    expect(await prisma.wallet.count()).toBe(2);
  });
});

describe("Withdrawal.idempotencyKey", () => {
  it("is what stops a double-clicked button producing two payouts", async () => {
    const user = await makeUser("ada@example.com", "ada");
    const wallet = await prisma.wallet.create({
      data: { userId: user.id, chain: "SOLANA", address: "9xQeWvG816bUx9EPa2rP1kQ4nJ8oTvBcYqk3ZmHt1Rdz" },
    });

    const request = {
      userId: user.id,
      walletId: wallet.id,
      chain: "SOLANA" as const,
      amount: new Prisma.Decimal("25.0000"),
      idempotencyKey: "client-generated-key",
    };

    await prisma.withdrawal.create({ data: request });

    await expect(prisma.withdrawal.create({ data: request })).rejects.toMatchObject({
      code: UNIQUE_VIOLATION,
    });
    expect(await prisma.withdrawal.count()).toBe(1);
  });
});

describe("Offer (network, networkOfferId)", () => {
  it("lets a sync upsert instead of duplicating the catalog every run", async () => {
    const identity = { network: "LOOTABLY" as const, networkOfferId: "lty-2001" };
    const fields = {
      ...identity,
      name: "Open a brokerage account",
      category: "SIGNUP" as const,
      countries: ["US"],
      devices: ["desktop"],
      advertiserPays: new Prisma.Decimal("48.0000"),
      userPays: new Prisma.Decimal("31.2000"),
    };

    await prisma.offer.create({ data: fields });
    await prisma.offer.upsert({
      where: { network_networkOfferId: identity },
      update: { name: "Open a brokerage account (renamed)" },
      create: fields,
    });

    const offers = await prisma.offer.findMany();
    expect(offers).toHaveLength(1);
    expect(offers[0]?.name).toContain("renamed");
  });
});
