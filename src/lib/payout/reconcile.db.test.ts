import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { reconcile, type HistorySource, type OutboundTransfer } from "@/lib/payout/reconcile";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

function history(transfers: OutboundTransfer[]): HistorySource {
  return {
    chain: "BASE",
    async recentOutbound() {
      return transfers;
    },
  };
}

async function member() {
  return makeUser({ email: "ada@example.com", handle: "ada" });
}

async function orphan(userId: string, amount: string, address: string, minutesAgo = 10) {
  // Upsert, not create: one address can only ever hold one wallet row, which is
  // the @@unique([chain, address]) guard. Two withdrawals to the same address
  // share it.
  const wallet = await prisma.wallet.upsert({
    where: { chain_address: { chain: "BASE", address } },
    create: { userId, chain: "BASE", address, verifiedAt: new Date() },
    update: {},
  });
  const row = await prisma.withdrawal.create({
    data: {
      userId,
      walletId: wallet.id,
      chain: "BASE",
      amount: new Prisma.Decimal(amount),
      // The state the window leaves behind: broadcast, but no hash written.
      status: "SENDING",
      idempotencyKey: `key-${Math.random()}`,
    },
  });
  return prisma.withdrawal.update({
    where: { id: row.id },
    data: { requestedAt: new Date(Date.now() - minutesAgo * 60_000) },
  });
}

const ADDRESS_A = `0x${"1".repeat(40)}`;
const ADDRESS_B = `0x${"2".repeat(40)}`;

describe("matching a lost hash", () => {
  it("attaches the transaction to the row that was waiting for it", async () => {
    const user = await member();
    const row = await orphan(user.id, "25.0000", ADDRESS_A);

    const report = await reconcile(
      history([
        { txHash: "0xaaa", to: ADDRESS_A, amountUsd: "25.00", at: new Date() },
      ]),
    );

    expect(report.matched).toBe(1);
    expect(report.unmatchedRows).toEqual([]);
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.txHash).toBe("0xaaa");
    // Still SENDING: reconciliation restores the record, it does not decide the
    // transaction confirmed. The confirmer does that.
    expect(after.status).toBe("SENDING");
  });

  it("does not match a transfer to a different address", async () => {
    const user = await member();
    const row = await orphan(user.id, "25.0000", ADDRESS_A);

    const report = await reconcile(
      history([{ txHash: "0xbbb", to: ADDRESS_B, amountUsd: "25.00", at: new Date() }]),
    );

    expect(report.matched).toBe(0);
    expect(report.unmatchedRows).toEqual([row.id]);
    expect(report.unmatchedTransfers).toEqual(["0xbbb"]);
  });

  it("does not match a different amount", async () => {
    const user = await member();
    await orphan(user.id, "25.0000", ADDRESS_A);

    const report = await reconcile(
      history([{ txHash: "0xccc", to: ADDRESS_A, amountUsd: "24.00", at: new Date() }]),
    );

    expect(report.matched).toBe(0);
  });

  it("does not match a transfer that predates the request", async () => {
    // Otherwise an older, unrelated payment to the same address for the same
    // amount would be claimed as this one, and the real transaction would then
    // look like money that left with no row behind it.
    const user = await member();
    await orphan(user.id, "25.0000", ADDRESS_A, 10);

    const report = await reconcile(
      history([
        {
          txHash: "0xold",
          to: ADDRESS_A,
          amountUsd: "25.00",
          at: new Date(Date.now() - 60 * 60_000),
        },
      ]),
    );

    expect(report.matched).toBe(0);
    expect(report.unmatchedTransfers).toEqual(["0xold"]);
  });
});

describe("one transaction can only ever pay one withdrawal", () => {
  it("does not attach the same hash to two rows", async () => {
    // This is the failure that would let a single transfer be credited twice.
    const user = await member();
    const first = await orphan(user.id, "25.0000", ADDRESS_A, 30);
    const second = await orphan(user.id, "25.0000", ADDRESS_A, 20);

    const report = await reconcile(
      history([{ txHash: "0xonce", to: ADDRESS_A, amountUsd: "25.00", at: new Date() }]),
    );

    expect(report.matched).toBe(1);
    const rows = await prisma.withdrawal.findMany({
      where: { id: { in: [first.id, second.id] } },
    });
    expect(rows.filter((row) => row.txHash === "0xonce")).toHaveLength(1);
    expect(report.unmatchedRows).toHaveLength(1);
  });

  it("will not reuse a hash that is already on another withdrawal", async () => {
    const user = await member();
    const settled = await orphan(user.id, "25.0000", ADDRESS_A, 60);
    await prisma.withdrawal.update({
      where: { id: settled.id },
      data: { txHash: "0xtaken", status: "SETTLED", settledAt: new Date() },
    });
    const waiting = await orphan(user.id, "25.0000", ADDRESS_A, 10);

    const report = await reconcile(
      history([{ txHash: "0xtaken", to: ADDRESS_A, amountUsd: "25.00", at: new Date() }]),
    );

    expect(report.matched).toBe(0);
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: waiting.id } });
    expect(after.txHash).toBeNull();
  });
});

describe("money that left with nothing asking for it", () => {
  it("is reported and never resolved automatically", async () => {
    const report = await reconcile(
      history([{ txHash: "0xrogue", to: ADDRESS_B, amountUsd: "900.00", at: new Date() }]),
    );

    expect(report.matched).toBe(0);
    expect(report.unmatchedTransfers).toEqual(["0xrogue"]);
  });
});

describe("rows that already have a hash", () => {
  it("are left alone", async () => {
    const user = await member();
    const row = await orphan(user.id, "25.0000", ADDRESS_A);
    await prisma.withdrawal.update({ where: { id: row.id }, data: { txHash: "0xknown" } });

    const report = await reconcile(
      history([{ txHash: "0xother", to: ADDRESS_A, amountUsd: "25.00", at: new Date() }]),
    );

    expect(report.matched).toBe(0);
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.txHash).toBe("0xknown");
  });
});
