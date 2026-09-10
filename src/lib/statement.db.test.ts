import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { statement } from "@/lib/statement";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

async function fixture() {
  const ada = await makeUser({ email: "ada@example.com", handle: "ada" });
  const other = await makeUser({ email: "reid@example.com", handle: "reid" });

  const wallet = await prisma.wallet.create({
    data: { userId: ada.id, chain: "SOLANA", address: "9xQeWvG816bUx9EPa2rP1kQ4nJ8oTvBcYqk3ZmHt1Rdz" },
  });

  await prisma.reward.create({
    data: {
      userId: ada.id,
      network: "TOROX",
      networkTxnId: "txn-ok",
      tierLabel: "Board level 32",
      amount: new Prisma.Decimal("61.1000"),
      advertiserPaid: new Prisma.Decimal("94.0000"),
      countryCode: "GB",
      rawPayload: {},
      status: "AVAILABLE",
      createdAt: new Date("2026-09-01T10:00:00Z"),
    },
  });

  await prisma.reward.create({
    data: {
      userId: ada.id,
      network: "CPX",
      networkTxnId: "txn-reversed",
      amount: new Prisma.Decimal("1.5600"),
      advertiserPaid: new Prisma.Decimal("2.4000"),
      countryCode: "GB",
      rawPayload: {},
      status: "REVERSED",
      createdAt: new Date("2026-09-03T10:00:00Z"),
    },
  });

  await prisma.withdrawal.create({
    data: {
      userId: ada.id,
      walletId: wallet.id,
      chain: "SOLANA",
      amount: new Prisma.Decimal("25.0000"),
      idempotencyKey: "key-1",
      status: "SETTLED",
      txHash: "5xhash",
      requestedAt: new Date("2026-09-05T10:00:00Z"),
    },
  });

  // Another member's reward, which must never appear in Ada's statement.
  await prisma.reward.create({
    data: {
      userId: other.id,
      network: "TOROX",
      networkTxnId: "txn-someone-else",
      amount: new Prisma.Decimal("99.0000"),
      advertiserPaid: new Prisma.Decimal("99.0000"),
      countryCode: "GB",
      rawPayload: {},
      status: "AVAILABLE",
    },
  });

  return ada;
}

describe("statement", () => {
  it("is empty for an account with no activity", async () => {
    const ada = await makeUser({ email: "ada@example.com", handle: "ada" });
    expect(await statement(ada.id)).toEqual([]);
  });

  it("merges rewards and withdrawals, newest first", async () => {
    const ada = await fixture();
    const rows = await statement(ada.id);

    expect(rows.map((r) => r.date.toISOString().slice(0, 10))).toEqual([
      "2026-09-05",
      "2026-09-03",
      "2026-09-01",
    ]);
  });

  it("includes reversals rather than quietly dropping them", async () => {
    const ada = await fixture();
    const rows = await statement(ada.id);
    expect(rows.some((r) => r.status === "REVERSED")).toBe(true);
  });

  it("signs withdrawals negative and rewards positive", async () => {
    const ada = await fixture();
    const rows = await statement(ada.id);

    const withdrawal = rows.find((r) => r.kind === "withdrawal");
    const reward = rows.find((r) => r.kind === "reward");
    expect(withdrawal?.amount.startsWith("-")).toBe(true);
    expect(reward?.amount.startsWith("-")).toBe(false);
  });

  it("never leaks another member's rows", async () => {
    const ada = await fixture();
    const rows = await statement(ada.id);
    expect(rows.some((r) => r.reference === "txn-someone-else")).toBe(false);
  });

  it("honours the since cutoff", async () => {
    const ada = await fixture();
    const rows = await statement(ada.id, new Date("2026-09-04T00:00:00Z"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("withdrawal");
  });

  it("carries the tier label so a multi-tier payout is identifiable", async () => {
    const ada = await fixture();
    const rows = await statement(ada.id);
    expect(rows.some((r) => r.description.includes("Board level 32"))).toBe(true);
  });
});
