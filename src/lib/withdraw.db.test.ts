import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { initialStatus, MIN_WITHDRAWAL, releaseAt, requestWithdrawal } from "@/lib/withdraw";
import { balanceOf } from "@/lib/balance";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

async function member(overrides: Record<string, unknown> = {}) {
  return makeUser({ email: "ada@example.com", handle: "ada", ...overrides });
}

async function credit(userId: string, amount: string) {
  return prisma.reward.create({
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

async function wallet(userId: string, verified = true) {
  return prisma.wallet.create({
    data: {
      userId,
      chain: "BASE",
      address: `0x${Math.random().toString(16).slice(2).padEnd(40, "0").slice(0, 40)}`,
      verifiedAt: verified ? new Date() : null,
    },
  });
}

describe("the idempotency key", () => {
  it("returns the same withdrawal for a repeated key, never a second one", async () => {
    const user = await member();
    await credit(user.id, "100.0000");
    const destination = await wallet(user.id);

    const first = await requestWithdrawal({
      userId: user.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("25"),
      idempotencyKey: "one-intent",
    });
    const second = await requestWithdrawal({
      userId: user.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("25"),
      idempotencyKey: "one-intent",
    });

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.withdrawal.id).toBe(first.withdrawal.id);
    expect(second.replayed).toBe(true);
    expect(await prisma.withdrawal.count()).toBe(1);
    // The balance moved once, not twice. This is the drain the guard exists for.
    expect((await balanceOf(user.id)).available.toFixed(2)).toBe("75.00");
  });

  it("holds under a genuine double-click, where both requests race", async () => {
    const user = await member();
    await credit(user.id, "100.0000");
    const destination = await wallet(user.id);

    const attempt = () =>
      requestWithdrawal({
        userId: user.id,
        walletId: destination.id,
        amount: new Prisma.Decimal("40"),
        idempotencyKey: "same-click",
      });

    const results = await Promise.all([attempt(), attempt(), attempt()]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(await prisma.withdrawal.count()).toBe(1);
    expect((await balanceOf(user.id)).available.toFixed(2)).toBe("60.00");
  });

  it("does not hand someone else's withdrawal back on a guessed key", async () => {
    const owner = await member();
    const stranger = await makeUser({ email: "bob@example.com", handle: "bob" });
    await credit(owner.id, "100.0000");
    const destination = await wallet(owner.id);

    await requestWithdrawal({
      userId: owner.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("20"),
      idempotencyKey: "guessable-key",
    });

    const result = await requestWithdrawal({
      userId: stranger.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("20"),
      idempotencyKey: "guessable-key",
    });

    expect(result).toEqual({ ok: false, reason: "unknown-wallet" });
  });
});

describe("two different requests cannot spend the same balance", () => {
  it("refuses the second when they run concurrently", async () => {
    const user = await member();
    await credit(user.id, "50.0000");
    const destination = await wallet(user.id);

    // Distinct keys, so idempotency does not save us here — only the row lock
    // and the in-transaction balance recomputation do.
    const results = await Promise.all([
      requestWithdrawal({
        userId: user.id,
        walletId: destination.id,
        amount: new Prisma.Decimal("40"),
        idempotencyKey: "key-a",
      }),
      requestWithdrawal({
        userId: user.id,
        walletId: destination.id,
        amount: new Prisma.Decimal("40"),
        idempotencyKey: "key-b",
      }),
    ]);

    const accepted = results.filter((result) => result.ok);
    expect(accepted).toHaveLength(1);
    expect((await balanceOf(user.id)).available.toFixed(2)).toBe("10.00");
  });
});

describe("what is refused", () => {
  it("refuses below the minimum", async () => {
    const user = await member();
    await credit(user.id, "100.0000");
    const destination = await wallet(user.id);

    const result = await requestWithdrawal({
      userId: user.id,
      walletId: destination.id,
      amount: MIN_WITHDRAWAL.sub("0.01"),
      idempotencyKey: "too-small",
    });

    expect(result).toEqual({ ok: false, reason: "below-minimum" });
    expect(await prisma.withdrawal.count()).toBe(0);
  });

  it("refuses more than the available balance", async () => {
    const user = await member();
    await credit(user.id, "30.0000");
    const destination = await wallet(user.id);

    const result = await requestWithdrawal({
      userId: user.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("30.0001"),
      idempotencyKey: "too-big",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("insufficient-balance");
    expect(result.available?.toFixed(2)).toBe("30.00");
  });

  it("refuses a wallet that was never verified", async () => {
    const user = await member();
    await credit(user.id, "100.0000");
    const destination = await wallet(user.id, false);

    const result = await requestWithdrawal({
      userId: user.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("20"),
      idempotencyKey: "unverified",
    });

    expect(result).toEqual({ ok: false, reason: "wallet-not-verified" });
  });

  it("refuses someone else's wallet", async () => {
    const user = await member();
    const stranger = await makeUser({ email: "bob@example.com", handle: "bob" });
    await credit(user.id, "100.0000");
    const notTheirs = await wallet(stranger.id);

    const result = await requestWithdrawal({
      userId: user.id,
      walletId: notTheirs.id,
      amount: new Prisma.Decimal("20"),
      idempotencyKey: "not-mine",
    });

    expect(result).toEqual({ ok: false, reason: "unknown-wallet" });
  });

  it("refuses a suspended member", async () => {
    const user = await member({ suspendedAt: new Date(), suspendReason: "Under review." });
    await credit(user.id, "100.0000");
    const destination = await wallet(user.id);

    const result = await requestWithdrawal({
      userId: user.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("20"),
      idempotencyKey: "suspended",
    });

    expect(result).toEqual({ ok: false, reason: "suspended" });
  });

  it("counts a pending reward as unavailable", async () => {
    const user = await member();
    await prisma.reward.create({
      data: {
        userId: user.id,
        network: "CPX",
        networkTxnId: "pending-1",
        amount: new Prisma.Decimal("100"),
        advertiserPaid: new Prisma.Decimal("100"),
        status: "PENDING",
        availableAt: new Date(Date.now() + 86_400_000),
        countryCode: "GB",
        rawPayload: {},
      },
    });
    const destination = await wallet(user.id);

    const result = await requestWithdrawal({
      userId: user.id,
      walletId: destination.id,
      amount: new Prisma.Decimal("10"),
      idempotencyKey: "still-pending",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("insufficient-balance");
  });
});

describe("the risk hold", () => {
  it("puts each tier where §6.1 says", () => {
    expect(initialStatus("NEW")).toBe("HELD");
    expect(initialStatus("STANDARD")).toBe("HELD");
    expect(initialStatus("TRUSTED")).toBe("APPROVED");
    // FLAGGED waits for a person, not a clock — so it is HELD with no release.
    expect(initialStatus("FLAGGED")).toBe("HELD");
  });

  it("gives a release time to the timed tiers and none to FLAGGED", () => {
    const at = new Date("2026-09-11T00:00:00Z");
    expect(releaseAt("NEW", at)?.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(releaseAt("STANDARD", at)?.toISOString()).toBe("2026-09-12T00:00:00.000Z");
    expect(releaseAt("TRUSTED", at)).toBeNull();
    expect(releaseAt("FLAGGED", at)).toBeNull();
  });

  it("releases a TRUSTED member immediately and holds a NEW one", async () => {
    for (const [tier, expected] of [
      ["TRUSTED", "APPROVED"],
      ["NEW", "HELD"],
      ["FLAGGED", "HELD"],
    ] as const) {
      await resetDatabase();
      const user = await member({ riskTier: tier });
      await credit(user.id, "100.0000");
      const destination = await wallet(user.id);

      const result = await requestWithdrawal({
        userId: user.id,
        walletId: destination.id,
        amount: new Prisma.Decimal("20"),
        idempotencyKey: `tier-${tier}`,
      });

      expect(result.ok, tier).toBe(true);
      if (result.ok) expect(result.withdrawal.status, tier).toBe(expected);
    }
  });
});
