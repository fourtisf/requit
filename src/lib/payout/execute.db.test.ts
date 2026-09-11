import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  DAILY_CAP,
  PER_PAYOUT_CAP,
  executeWithdrawal,
  releaseMaturedHolds,
  settleWithdrawal,
  type Sender,
  type TxState,
} from "@/lib/payout/execute";
import { balanceOf } from "@/lib/balance";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

/**
 * A chain that does what the test tells it to.
 *
 * The point of this file is the ordering around the broadcast — claim, send,
 * persist — and the behaviour when the broadcast is ambiguous. None of that is
 * observable against a real chain in a test, and all of it is what loses money.
 */
function fakeSender(behaviour: {
  send?: () => Promise<{ txHash: string }>;
  confirm?: TxState;
  balance?: string;
} = {}): Sender & { sends: number } {
  const sender = {
    chain: "BASE" as const,
    sends: 0,
    async send() {
      sender.sends += 1;
      return behaviour.send ? behaviour.send() : { txHash: `0x${"a".repeat(64)}` };
    },
    async confirm(): Promise<TxState> {
      return behaviour.confirm ?? "confirmed";
    },
    async balanceUsd() {
      return new Prisma.Decimal(behaviour.balance ?? "100000");
    },
  };
  return sender;
}

async function member(overrides: Record<string, unknown> = {}) {
  return makeUser({ email: "ada@example.com", handle: "ada", ...overrides });
}

async function credit(userId: string, amount: string) {
  await prisma.reward.create({
    data: {
      userId,
      network: "TOROX",
      networkTxnId: `txn-${Math.random()}`,
      amount: new Prisma.Decimal(amount),
      advertiserPaid: new Prisma.Decimal(amount),
      status: "AVAILABLE",
      countryCode: "GB",
      rawPayload: {},
    },
  });
}

async function withdrawal(
  userId: string,
  amount: string,
  status: "APPROVED" | "HELD" | "SENDING" = "APPROVED",
  verified = true,
) {
  const wallet = await prisma.wallet.create({
    data: {
      userId,
      chain: "BASE",
      address: `0x${Math.random().toString(16).slice(2).padEnd(40, "0").slice(0, 40)}`,
      verifiedAt: verified ? new Date() : null,
    },
  });
  return prisma.withdrawal.create({
    data: {
      userId,
      walletId: wallet.id,
      chain: "BASE",
      amount: new Prisma.Decimal(amount),
      status,
      idempotencyKey: `key-${Math.random()}`,
    },
  });
}

describe("sending", () => {
  it("claims the row before broadcasting and records the hash after", async () => {
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25");
    const sender = fakeSender();

    const outcome = await executeWithdrawal(row.id, sender);

    expect(outcome).toEqual({ kind: "sent", txHash: `0x${"a".repeat(64)}` });
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("SENDING");
    expect(after.txHash).toBe(`0x${"a".repeat(64)}`);
    // SETTLED is the confirmer's job, not the sender's — broadcast is not
    // delivery, and marking it settled here would tell the member they were
    // paid before the chain agreed.
    expect(after.settledAt).toBeNull();
  });

  it("broadcasts exactly once when two workers race for the same row", async () => {
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25");
    const sender = fakeSender();

    const results = await Promise.all([
      executeWithdrawal(row.id, sender),
      executeWithdrawal(row.id, sender),
      executeWithdrawal(row.id, sender),
    ]);

    expect(results.filter((result) => result.kind === "sent")).toHaveLength(1);
    expect(sender.sends).toBe(1);
  });

  it("will not send a withdrawal that is not APPROVED", async () => {
    const user = await member();
    await credit(user.id, "100");
    const sender = fakeSender();

    for (const status of ["HELD", "SENDING"] as const) {
      const row = await withdrawal(user.id, "25", status);
      expect(await executeWithdrawal(row.id, sender)).toEqual({
        kind: "skipped",
        why: "not-approved",
      });
    }
    expect(sender.sends).toBe(0);
  });

  it("will not send to a wallet whose verification was withdrawn", async () => {
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25", "APPROVED", false);

    const sender = fakeSender();
    expect(await executeWithdrawal(row.id, sender)).toEqual({
      kind: "skipped",
      why: "wallet-unverified",
    });
    expect(sender.sends).toBe(0);
  });
});

describe("an ambiguous broadcast", () => {
  it("leaves the row SENDING and asks for a person, never FAILED", async () => {
    // §6.2: "Never retry a SENDING row automatically." A throw does not mean
    // the transaction did not land — marking it FAILED would return the amount
    // to the balance and let the same money go out twice.
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25");

    const sender = fakeSender({
      send: () => Promise.reject(new Error("socket hang up")),
    });

    const outcome = await executeWithdrawal(row.id, sender);

    expect(outcome.kind).toBe("needs-review");
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("SENDING");
    expect(after.failureReason).toContain("manual");
    // The amount stays committed, so the balance does not reopen.
    expect((await balanceOf(user.id)).available.toFixed(2)).toBe("75.00");
  });

  it("does not retry it on a later run", async () => {
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25");

    const failing = fakeSender({ send: () => Promise.reject(new Error("timeout")) });
    await executeWithdrawal(row.id, failing);

    const healthy = fakeSender();
    expect(await executeWithdrawal(row.id, healthy)).toEqual({
      kind: "skipped",
      why: "not-approved",
    });
    expect(healthy.sends).toBe(0);
  });
});

describe("caps", () => {
  it("refuses a single payout above the per-payout cap", async () => {
    const user = await member();
    await credit(user.id, "10000");
    const row = await withdrawal(user.id, PER_PAYOUT_CAP.add("0.01").toFixed(2));

    const sender = fakeSender();
    expect(await executeWithdrawal(row.id, sender)).toEqual({
      kind: "skipped",
      why: "over-per-payout-cap",
    });
    expect(sender.sends).toBe(0);
    // Still APPROVED, so a person can release it deliberately.
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("APPROVED");
  });

  it("refuses once the rolling day's total would exceed the daily cap", async () => {
    const user = await member();
    await credit(user.id, "100000");

    const already = await withdrawal(user.id, DAILY_CAP.toFixed(2), "APPROVED");
    await prisma.withdrawal.update({ where: { id: already.id }, data: { status: "SETTLED" } });

    const next = await withdrawal(user.id, "50");
    const sender = fakeSender();

    expect(await executeWithdrawal(next.id, sender)).toEqual({
      kind: "skipped",
      why: "over-daily-cap",
    });
    expect(sender.sends).toBe(0);
  });

  it("refuses when the hot wallet cannot cover it", async () => {
    const user = await member();
    await credit(user.id, "1000");
    const row = await withdrawal(user.id, "400");

    const sender = fakeSender({ balance: "100" });
    expect(await executeWithdrawal(row.id, sender)).toEqual({
      kind: "skipped",
      why: "insufficient-float",
    });
    expect(sender.sends).toBe(0);
  });
});

describe("settling", () => {
  it("marks a confirmed transaction SETTLED and stamps the time", async () => {
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25");
    await executeWithdrawal(row.id, fakeSender());

    expect(await settleWithdrawal(row.id, fakeSender({ confirm: "confirmed" }))).toBe("settled");

    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("SETTLED");
    expect(after.settledAt).toBeInstanceOf(Date);
    expect((await balanceOf(user.id)).paidOut.toFixed(2)).toBe("25.00");
  });

  it("returns the money when the chain rejected the transaction", async () => {
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25");
    await executeWithdrawal(row.id, fakeSender());

    expect(await settleWithdrawal(row.id, fakeSender({ confirm: "failed" }))).toBe("failed");

    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("FAILED");
    // Nothing moved on chain, so the balance genuinely reopens.
    expect((await balanceOf(user.id)).available.toFixed(2)).toBe("100.00");
  });

  it("leaves a pending transaction alone", async () => {
    const user = await member();
    await credit(user.id, "100");
    const row = await withdrawal(user.id, "25");
    await executeWithdrawal(row.id, fakeSender());

    expect(await settleWithdrawal(row.id, fakeSender({ confirm: "pending" }))).toBe("pending");
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("SENDING");
  });
});

describe("releasing held withdrawals", () => {
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000);

  async function held(tier: "NEW" | "STANDARD" | "TRUSTED" | "FLAGGED", requestedAt: Date) {
    const user = await makeUser({
      email: `${tier}-${Math.random()}@example.com`,
      handle: `h${Math.random().toString(36).slice(2, 10)}`,
      riskTier: tier,
    });
    await credit(user.id, "1000");
    const row = await withdrawal(user.id, "25", "HELD");
    await prisma.withdrawal.update({ where: { id: row.id }, data: { requestedAt } });
    return row;
  }

  it("releases NEW after 72 hours and not before", async () => {
    const early = await held("NEW", hoursAgo(71));
    const due = await held("NEW", hoursAgo(73));

    expect(await releaseMaturedHolds()).toBe(1);
    expect((await prisma.withdrawal.findUniqueOrThrow({ where: { id: early.id } })).status).toBe("HELD");
    expect((await prisma.withdrawal.findUniqueOrThrow({ where: { id: due.id } })).status).toBe("APPROVED");
  });

  it("releases STANDARD after 24 hours", async () => {
    const early = await held("STANDARD", hoursAgo(23));
    const due = await held("STANDARD", hoursAgo(25));

    expect(await releaseMaturedHolds()).toBe(1);
    expect((await prisma.withdrawal.findUniqueOrThrow({ where: { id: early.id } })).status).toBe("HELD");
    expect((await prisma.withdrawal.findUniqueOrThrow({ where: { id: due.id } })).status).toBe("APPROVED");
  });

  it("never releases FLAGGED, however long it has waited", async () => {
    // Its hold is a person, not a clock. A timer that released it would quietly
    // undo every manual review the tier exists to force.
    const ancient = await held("FLAGGED", hoursAgo(24 * 365));

    expect(await releaseMaturedHolds()).toBe(0);
    expect((await prisma.withdrawal.findUniqueOrThrow({ where: { id: ancient.id } })).status).toBe("HELD");
  });

  it("reads the member's current tier, so flagging someone mid-hold stops the clock", async () => {
    const row = await held("NEW", hoursAgo(100));
    const withdrawalRow = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    await prisma.user.update({
      where: { id: withdrawalRow.userId },
      data: { riskTier: "FLAGGED" },
    });

    expect(await releaseMaturedHolds()).toBe(0);
  });
});
