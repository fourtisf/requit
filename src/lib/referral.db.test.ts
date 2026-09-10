import { beforeEach, describe, expect, it } from "vitest";
import { requitAdapter } from "@/lib/auth/adapter";
import { generateReferralCode } from "@/lib/referral";
import { makeUser, prisma, resetDatabase } from "@/test/db";
import type { AdapterUser } from "next-auth/adapters";

const adapter = requitAdapter();

function createUser(email: string) {
  if (!adapter.createUser) throw new Error("adapter is missing createUser");
  return adapter.createUser({
    id: crypto.randomUUID(),
    email,
    emailVerified: new Date(),
  } as unknown as AdapterUser);
}

beforeEach(async () => {
  await resetDatabase();
});

describe("referral columns", () => {
  it("gives every new account its own code and unsubscribe token", async () => {
    const first = await createUser("ada@example.com");
    const second = await createUser("reid@example.com");

    const users = await prisma.user.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { referralCode: true, unsubscribeToken: true },
    });

    expect(new Set(users.map((u) => u.referralCode)).size).toBe(2);
    expect(new Set(users.map((u) => u.unsubscribeToken)).size).toBe(2);
    expect(users.every((u) => u.referralCode.length === 8)).toBe(true);
  });

  it("refuses two accounts sharing a referral code", async () => {
    const code = generateReferralCode();
    await makeUser({ email: "ada@example.com", handle: "ada", referralCode: code });

    await expect(
      makeUser({ email: "reid@example.com", handle: "reid", referralCode: code }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("starts everyone opted in to notifications", async () => {
    // These say a member's money moved. Defaulting them off would mean
    // silently withholding that.
    const user = await createUser("ada@example.com");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.notifyRewards).toBe(true);
    expect(stored.notifyWithdrawals).toBe(true);
    expect(stored.notifyDisputes).toBe(true);
  });

  it("creates a signup uncredited when there is no referral cookie", async () => {
    const user = await createUser("ada@example.com");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.referredById).toBeNull();
    expect(stored.referredAt).toBeNull();
  });
});

describe("referral graph", () => {
  it("links referrer to referred in both directions", async () => {
    const referrer = await makeUser({ email: "ada@example.com", handle: "ada" });
    await makeUser({
      email: "reid@example.com",
      handle: "reid",
      referredBy: { connect: { id: referrer.id } },
      referredAt: new Date(),
    });

    const withReferrals = await prisma.user.findUniqueOrThrow({
      where: { id: referrer.id },
      include: { referrals: { select: { handle: true } } },
    });

    expect(withReferrals.referrals.map((r) => r.handle)).toEqual(["reid"]);
  });

  it("keeps the referred account when the referrer is deleted", async () => {
    // ON DELETE SET NULL, not CASCADE. Deleting a referrer must never take the
    // people they referred — and their balances — with it.
    const referrer = await makeUser({ email: "ada@example.com", handle: "ada" });
    const referred = await makeUser({
      email: "reid@example.com",
      handle: "reid",
      referredBy: { connect: { id: referrer.id } },
      referredAt: new Date(),
    });

    await prisma.user.delete({ where: { id: referrer.id } });

    const survivor = await prisma.user.findUnique({ where: { id: referred.id } });
    expect(survivor).not.toBeNull();
    expect(survivor?.referredById).toBeNull();
  });
});
