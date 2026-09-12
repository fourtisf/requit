import { beforeEach, describe, expect, it } from "vitest";
import { readinessFor } from "@/lib/readiness";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import { makeUser, prisma, resetDatabase } from "@/test/db";

/**
 * Every step is checked against the database rather than ticked by clicking,
 * which is the only thing that makes the list worth showing: a checklist you
 * can complete by pressing "done" measures nothing.
 */

beforeEach(async () => {
  await resetDatabase();
});

let seq = 0;
async function member(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return makeUser({ email: `r${seq}@example.com`, handle: `ready${seq}`, ...overrides });
}

const step = (steps: Awaited<ReturnType<typeof readinessFor>>["steps"], id: string) =>
  steps.find((entry) => entry.id === id)!;

describe("a new member", () => {
  it("has the country step already done when signup knew where they were", async () => {
    const user = await member({ countryCode: "ID" });
    const { steps } = await readinessFor(user.id);
    expect(step(steps, "country").done).toBe(true);
    expect(step(steps, "country").href).toBeNull();
  });

  it("is sent to settings when signup could not tell", async () => {
    // Offers are matched by country: without one they are eligible for nothing,
    // whatever goes live.
    const user = await member({ countryCode: UNKNOWN_COUNTRY });
    const { steps } = await readinessFor(user.id);
    expect(step(steps, "country").done).toBe(false);
    expect(step(steps, "country").href).toBe("/settings");
  });

  it("starts with the notification step done, since both default to on", async () => {
    const user = await member();
    const { steps } = await readinessFor(user.id);
    expect(step(steps, "notify").done).toBe(true);
  });

  it("has everything else still to do", async () => {
    const user = await member({ countryCode: "ID" });
    const { done, total, steps } = await readinessFor(user.id);
    expect(total).toBe(6);
    expect(done).toBe(2); // country and notifications
    for (const id of ["wallet", "waiting", "referral", "played"]) {
      expect(step(steps, id).done, id).toBe(false);
    }
  });
});

describe("counting a wallet", () => {
  it("wants one that has been verified, not merely typed in", async () => {
    const user = await member();
    const wallet = await prisma.wallet.create({
      data: { userId: user.id, chain: "BASE", address: "0xabc", isPayout: true },
    });

    expect(step((await readinessFor(user.id)).steps, "wallet").done).toBe(false);

    await prisma.wallet.update({ where: { id: wallet.id }, data: { verifiedAt: new Date() } });
    expect(step((await readinessFor(user.id)).steps, "wallet").done).toBe(true);
  });
});

describe("counting the rest", () => {
  it("sees the country list, a referral and a finished round", async () => {
    const user = await member({ countryCode: "ID" });

    await prisma.countryInterest.create({ data: { userId: user.id, countryCode: "ID" } });
    await member({ referredById: user.id, referredAt: new Date() });
    await prisma.gameSession.create({
      data: { userId: user.id, game: "spot", seed: 1, score: 120, endedAt: new Date() },
    });

    const { steps, done } = await readinessFor(user.id);
    expect(step(steps, "waiting").done).toBe(true);
    expect(step(steps, "referral").done).toBe(true);
    expect(step(steps, "referral").action).toBe("1 joined");
    expect(step(steps, "played").done).toBe(true);
    // Five of six: no wallet has been verified in this one.
    expect(done).toBe(5);
    expect(step(steps, "wallet").done).toBe(false);
  });

  it("does not count a round that was never finished", async () => {
    // An open session is somebody who pressed start, which is not playing.
    const user = await member();
    await prisma.gameSession.create({ data: { userId: user.id, game: "spot", seed: 1 } });
    expect(step((await readinessFor(user.id)).steps, "played").done).toBe(false);
  });

  it("counts nothing belonging to somebody else", async () => {
    const user = await member({ countryCode: "ID" });
    const stranger = await member({ countryCode: "ID" });

    await prisma.countryInterest.create({ data: { userId: stranger.id, countryCode: "ID" } });
    await prisma.gameSession.create({
      data: { userId: stranger.id, game: "spot", seed: 1, score: 90, endedAt: new Date() },
    });

    const { steps } = await readinessFor(user.id);
    expect(step(steps, "waiting").done).toBe(false);
    expect(step(steps, "played").done).toBe(false);
  });
});

describe("promising nothing", () => {
  it("never says a step pays", async () => {
    // The category's oldest trick is a bar to fill in place of a product. If a
    // step ever starts quoting money, this fails.
    const user = await member();
    const { steps } = await readinessFor(user.id);
    for (const entry of steps) {
      expect(`${entry.title} ${entry.why}`).not.toMatch(/\$|earn|reward per|bonus|paid for/i);
    }
  });
});
