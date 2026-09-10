import { beforeEach, describe, expect, it, vi } from "vitest";
import { notify } from "@/lib/notify";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
  vi.restoreAllMocks();
});

function message(userId: string, kind: "reward" | "withdrawal" | "dispute" = "reward") {
  return { userId, kind, subject: "Your task was confirmed", body: "TOROX confirmed $12.50." };
}

describe("notify", () => {
  it("sends when the member has the preference on", async () => {
    const ada = await makeUser({ email: "ada@example.com", handle: "ada" });
    await expect(notify(message(ada.id))).resolves.toEqual({ sent: true });
  });

  it("respects the per-kind preference", async () => {
    const ada = await makeUser({
      email: "ada@example.com",
      handle: "ada",
      notifyRewards: false,
    });

    await expect(notify(message(ada.id, "reward"))).resolves.toEqual({
      sent: false,
      reason: "opted-out",
    });

    // Turning rewards off must not turn withdrawals off with it.
    await expect(notify(message(ada.id, "withdrawal"))).resolves.toEqual({ sent: true });
  });

  it("still notifies a suspended member", async () => {
    // Suspension pauses earning and withdrawal. It does not mean we stop telling
    // someone what happened to money that is still theirs.
    const ada = await makeUser({
      email: "ada@example.com",
      handle: "ada",
      suspendedAt: new Date(),
      suspendReason: "Under review",
    });

    await expect(notify(message(ada.id))).resolves.toEqual({ sent: true });
  });

  it("reports a missing user rather than throwing into the caller", async () => {
    // This runs from a queue worker. An exception here would fail a job whose
    // real work already succeeded.
    await expect(notify(message("user_that_does_not_exist"))).resolves.toEqual({
      sent: false,
      reason: "no-user",
    });
  });

  it("unsubscribing turns every kind off at once", async () => {
    const ada = await makeUser({ email: "ada@example.com", handle: "ada" });

    await prisma.user.updateMany({
      where: { unsubscribeToken: ada.unsubscribeToken },
      data: { notifyRewards: false, notifyWithdrawals: false, notifyDisputes: false },
    });

    for (const kind of ["reward", "withdrawal", "dispute"] as const) {
      await expect(notify(message(ada.id, kind))).resolves.toEqual({
        sent: false,
        reason: "opted-out",
      });
    }
  });

  it("an unknown unsubscribe token changes nothing", async () => {
    const ada = await makeUser({ email: "ada@example.com", handle: "ada" });

    const result = await prisma.user.updateMany({
      where: { unsubscribeToken: "not-a-real-token" },
      data: { notifyRewards: false },
    });

    expect(result.count).toBe(0);
    await expect(notify(message(ada.id))).resolves.toEqual({ sent: true });
  });
});
