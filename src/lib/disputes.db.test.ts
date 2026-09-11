import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { advanceDispute, MAX_OPEN_DISPUTES, submitDispute } from "@/lib/disputes";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

const REASON = "I finished Town Hall 8 on 3 September and nothing was credited.";

async function member(overrides: Record<string, unknown> = {}) {
  return makeUser({ email: "ada@example.com", handle: "ada", ...overrides });
}

function open(userId: string, overrides: Partial<Parameters<typeof submitDispute>[0]> = {}) {
  return submitDispute({
    userId,
    network: "TOROX",
    claimedAmount: new Prisma.Decimal("12.50"),
    reason: REASON,
    evidenceUrls: [],
    ...overrides,
  });
}

describe("opening a dispute", () => {
  it("records the reason and starts at SUBMITTED with no reply yet", async () => {
    const user = await member();
    const result = await open(user.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dispute.status).toBe("SUBMITTED");
    expect(result.dispute.statusNote).toBe(REASON);
    // firstReplyAt is what the published time-to-first-reply is measured
    // against. Stamping it at submission would make every figure zero.
    expect(result.dispute.firstReplyAt).toBeNull();
  });

  it("refuses a reason too short to act on", async () => {
    const user = await member();
    expect(await open(user.id, { reason: "not paid" })).toEqual({
      ok: false,
      reason: "no-reason",
    });
  });

  it("refuses a nonsense amount", async () => {
    const user = await member();
    for (const amount of ["0", "-5", "99999"]) {
      const result = await open(user.id, { claimedAmount: new Prisma.Decimal(amount) });
      expect(result, amount).toEqual({ ok: false, reason: "bad-amount" });
    }
  });

  it("refuses a suspended member", async () => {
    const user = await member({ suspendedAt: new Date(), suspendReason: "Under review." });
    expect(await open(user.id)).toEqual({ ok: false, reason: "suspended" });
  });

  it("caps how many can be open at once", async () => {
    const user = await member();
    for (let index = 0; index < MAX_OPEN_DISPUTES; index += 1) {
      expect((await open(user.id)).ok, `#${index}`).toBe(true);
    }
    expect(await open(user.id)).toEqual({ ok: false, reason: "too-many-open" });
  });

  it("counts only open ones against the cap", async () => {
    const user = await member();
    for (let index = 0; index < MAX_OPEN_DISPUTES; index += 1) await open(user.id);

    const first = await prisma.dispute.findFirstOrThrow();
    await advanceDispute({
      disputeId: first.id,
      to: "RESOLVED",
      note: "Paid it.",
      outcome: "PAID",
    });

    expect((await open(user.id)).ok).toBe(true);
  });
});

describe("evidence links", () => {
  it("accepts http and https", async () => {
    const user = await member();
    const result = await open(user.id, {
      evidenceUrls: ["https://example.com/shot.png", "http://example.com/2.png"],
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a scheme an operator could be attacked through", async () => {
    // These are rendered as links in the admin panel; an operator clicking one
    // is the whole attack.
    const user = await member();
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "not a url",
    ]) {
      const result = await open(user.id, { evidenceUrls: [url] });
      expect(result, url).toEqual({ ok: false, reason: "bad-evidence-url" });
    }
  });

  it("refuses more links than we will read", async () => {
    const user = await member();
    const result = await open(user.id, {
      evidenceUrls: Array.from({ length: 9 }, (_, i) => `https://example.com/${i}.png`),
    });
    expect(result).toEqual({ ok: false, reason: "too-much-evidence" });
  });
});

describe("moving a dispute", () => {
  async function opened() {
    const user = await member();
    const result = await open(user.id);
    if (!result.ok) throw new Error("setup failed");
    return result.dispute;
  }

  it("stamps first reply once, on the first move, and never again", async () => {
    const dispute = await opened();

    await advanceDispute({ disputeId: dispute.id, to: "ACKNOWLEDGED", note: "Looking at it." });
    const afterFirst = await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } });
    expect(afterFirst.firstReplyAt).toBeInstanceOf(Date);

    await advanceDispute({ disputeId: dispute.id, to: "ESCALATED", note: "Sent to the network." });
    const afterSecond = await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } });
    // Re-stamping would flatter the published figure on every later move.
    expect(afterSecond.firstReplyAt?.getTime()).toBe(afterFirst.firstReplyAt?.getTime());
    expect(afterSecond.escalatedAt).toBeInstanceOf(Date);
  });

  it("refuses to move backwards", async () => {
    const dispute = await opened();
    await advanceDispute({ disputeId: dispute.id, to: "ESCALATED", note: "Escalated." });

    expect(
      await advanceDispute({ disputeId: dispute.id, to: "ACKNOWLEDGED", note: "Oops." }),
    ).toEqual({ ok: false, reason: "backwards" });
  });

  it("refuses to move to the status it is already in", async () => {
    const dispute = await opened();
    expect(
      await advanceDispute({ disputeId: dispute.id, to: "SUBMITTED", note: "No change." }),
    ).toEqual({ ok: false, reason: "backwards" });
  });

  it("will not close without an outcome", async () => {
    // A dispute that closes with no answer is the black hole this flow exists
    // to replace, and §8 publishes a paid rate computed from the outcome.
    const dispute = await opened();
    expect(
      await advanceDispute({ disputeId: dispute.id, to: "RESOLVED", note: "Done." }),
    ).toEqual({ ok: false, reason: "needs-outcome" });

    const after = await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } });
    expect(after.status).toBe("SUBMITTED");
  });

  it("closes with an outcome and a resolution time", async () => {
    const dispute = await opened();
    const result = await advanceDispute({
      disputeId: dispute.id,
      to: "RESOLVED",
      note: "The advertiser refused it.",
      outcome: "REJECTED_BY_ADVERTISER",
    });

    expect(result).toEqual({ ok: true });
    const after = await prisma.dispute.findUniqueOrThrow({ where: { id: dispute.id } });
    expect(after.status).toBe("RESOLVED");
    expect(after.outcome).toBe("REJECTED_BY_ADVERTISER");
    expect(after.resolvedAt).toBeInstanceOf(Date);
  });

  it("refuses to reopen a closed dispute", async () => {
    const dispute = await opened();
    await advanceDispute({
      disputeId: dispute.id,
      to: "RESOLVED",
      note: "Paid.",
      outcome: "PAID",
    });

    expect(
      await advanceDispute({ disputeId: dispute.id, to: "ESCALATED", note: "Again." }),
    ).toEqual({ ok: false, reason: "already-resolved" });
  });

  it("refuses an unknown dispute", async () => {
    expect(
      await advanceDispute({ disputeId: "nope", to: "ACKNOWLEDGED", note: "x" }),
    ).toEqual({ ok: false, reason: "unknown" });
  });
});
