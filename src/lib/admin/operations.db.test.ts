import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  approveWithdrawal,
  reinstateMember,
  rejectWithdrawal,
  setRiskTier,
  suspendMember,
} from "@/lib/admin/operations";
import { balanceOf } from "@/lib/balance";
import { makeUser, prisma, resetDatabase } from "@/test/db";

const ACTOR = "ops@example.com";

beforeEach(async () => {
  await resetDatabase();
});

async function member(overrides: Record<string, unknown> = {}) {
  return makeUser({ email: "ada@example.com", handle: "ada", ...overrides });
}

async function reward(userId: string, amount: string, status: "AVAILABLE" | "REVERSED" = "AVAILABLE") {
  return prisma.reward.create({
    data: {
      userId,
      network: "TOROX",
      networkTxnId: `txn-${Math.random()}`,
      amount: new Prisma.Decimal(amount),
      advertiserPaid: new Prisma.Decimal(amount),
      status,
      countryCode: "GB",
      rawPayload: {},
    },
  });
}

async function withdrawal(
  userId: string,
  amount: string,
  status: "REQUESTED" | "HELD" | "SETTLED" | "SENDING" = "HELD",
) {
  const wallet = await prisma.wallet.create({
    data: { userId, chain: "BASE", address: `0x${Math.random().toString(16).slice(2)}`, verifiedAt: new Date() },
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

describe("a reason is mandatory", () => {
  it("refuses a suspension with no reason, and changes nothing", async () => {
    const user = await member();

    const result = await suspendMember({ actorEmail: ACTOR, userId: user.id, reason: "  " });

    expect(result).toEqual({ ok: false, error: expect.stringContaining("reason") });
    // §7: never ban silently. A suspension with no reason is exactly the
    // unexplained ban the product positions against, so nothing is written —
    // not the suspension, and not an audit row claiming one happened.
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.suspendedAt).toBeNull();
    expect(await prisma.adminAction.count()).toBe(0);
  });

  it("refuses a one-word reason", async () => {
    const user = await member();
    const result = await suspendMember({ actorEmail: ACTOR, userId: user.id, reason: "fraud" });
    expect(result.ok).toBe(false);
  });
});

describe("suspension", () => {
  it("records the reason the member is shown, and who did it", async () => {
    const user = await member();

    const result = await suspendMember({
      actorEmail: "Ops@Example.com",
      userId: user.id,
      reason: "Six accounts on one device fingerprint.",
    });

    expect(result).toEqual({ ok: true });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.suspendedAt).toBeInstanceOf(Date);
    expect(after.suspendReason).toBe("Six accounts on one device fingerprint.");

    const entries = await prisma.adminAction.findMany();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: "suspend",
      subjectId: user.id,
      actorEmail: "ops@example.com", // normalised, so the audit groups by person
      reason: "Six accounts on one device fingerprint.",
    });
  });

  it("refuses to suspend twice, so the original reason is not overwritten", async () => {
    const user = await member();
    await suspendMember({ actorEmail: ACTOR, userId: user.id, reason: "First reason here." });

    const second = await suspendMember({
      actorEmail: ACTOR,
      userId: user.id,
      reason: "A different reason.",
    });

    expect(second).toEqual({ ok: false, error: "Already suspended." });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.suspendReason).toBe("First reason here.");
  });

  it("keeps the old reason in the audit trail when reinstating", async () => {
    const user = await member();
    await suspendMember({ actorEmail: ACTOR, userId: user.id, reason: "Suspected device farm." });

    await reinstateMember({
      actorEmail: ACTOR,
      userId: user.id,
      reason: "Appealed with proof; the second account is a sibling.",
    });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.suspendedAt).toBeNull();
    expect(after.suspendReason).toBeNull();

    // The account no longer carries the reason, so the only surviving record of
    // what they were accused of is this one.
    const entry = await prisma.adminAction.findFirstOrThrow({ where: { action: "reinstate" } });
    expect(entry.detail).toMatchObject({ wasReason: "Suspected device farm." });
  });
});

describe("risk tier", () => {
  it("records both sides of the move", async () => {
    const user = await member();

    await setRiskTier({
      actorEmail: ACTOR,
      userId: user.id,
      tier: "TRUSTED",
      reason: "Forty settled completions, no reversals.",
    });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.riskTier).toBe("TRUSTED");

    const entry = await prisma.adminAction.findFirstOrThrow({ where: { action: "set-tier" } });
    expect(entry.detail).toMatchObject({ from: "NEW", to: "TRUSTED" });
  });

  it("refuses a no-op, so the audit is not filled with non-changes", async () => {
    const user = await member();
    const result = await setRiskTier({
      actorEmail: ACTOR,
      userId: user.id,
      tier: "NEW",
      reason: "No change intended here.",
    });
    expect(result.ok).toBe(false);
    expect(await prisma.adminAction.count()).toBe(0);
  });
});

describe("withdrawal review", () => {
  it("approves a held withdrawal without sending it", async () => {
    const user = await member();
    await reward(user.id, "40.0000");
    const row = await withdrawal(user.id, "25.0000");

    const result = await approveWithdrawal({
      actorEmail: ACTOR,
      withdrawalId: row.id,
      reason: "Wallet verified, device history clean.",
    });

    expect(result).toEqual({ ok: true });
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    // APPROVED, not SENDING: one place broadcasts transactions and it is the
    // payout worker, never a request handler.
    expect(after.status).toBe("APPROVED");
    expect(after.txHash).toBeNull();
  });

  it("refuses to approve when a reversal left the member short", async () => {
    const user = await member();
    await reward(user.id, "40.0000");
    const row = await withdrawal(user.id, "40.0000", "SETTLED");
    // The network takes the reward back after we already paid.
    await prisma.reward.updateMany({ where: { userId: user.id }, data: { status: "REVERSED" } });

    const pending = await withdrawal(user.id, "5.0000");
    const result = await approveWithdrawal({
      actorEmail: ACTOR,
      withdrawalId: pending.id,
      reason: "Looks fine at a glance.",
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: expect.stringContaining("short") });
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: pending.id } });
    expect(after.status).toBe("HELD");
    expect(row.status).toBe("SETTLED");
  });

  it("refuses to approve the same withdrawal twice", async () => {
    const user = await member();
    await reward(user.id, "40.0000");
    const row = await withdrawal(user.id, "25.0000");

    const first = await approveWithdrawal({
      actorEmail: ACTOR,
      withdrawalId: row.id,
      reason: "Checked and cleared.",
    });
    const second = await approveWithdrawal({
      actorEmail: "other@example.com",
      withdrawalId: row.id,
      reason: "Checked and cleared.",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(await prisma.adminAction.count({ where: { action: "approve-withdrawal" } })).toBe(1);
  });

  it("returns the money to the balance when rejected", async () => {
    const user = await member();
    await reward(user.id, "40.0000");
    const row = await withdrawal(user.id, "25.0000");

    // While it is committed, it is out of the available balance.
    expect((await balanceOf(user.id)).available.toFixed(2)).toBe("15.00");

    const result = await rejectWithdrawal({
      actorEmail: ACTOR,
      withdrawalId: row.id,
      reason: "Wallet address belongs to another member.",
    });

    expect(result).toEqual({ ok: true });
    const after = await prisma.withdrawal.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe("FAILED");
    expect(after.failureReason).toBe("Wallet address belongs to another member.");
    expect((await balanceOf(user.id)).available.toFixed(2)).toBe("40.00");
  });

  it("refuses to reject something already on chain", async () => {
    const user = await member();
    await reward(user.id, "40.0000");

    for (const status of ["SENDING", "SETTLED"] as const) {
      const row = await withdrawal(user.id, "5.0000", status);
      const result = await rejectWithdrawal({
        actorEmail: ACTOR,
        withdrawalId: row.id,
        reason: "Changed my mind about this one.",
      });
      expect(result).toEqual({ ok: false, error: "Already on chain. It cannot be rejected." });
    }
  });
});
