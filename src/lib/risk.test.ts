import { describe, expect, it } from "vitest";
import { TIER_LADDER, TIER_RULES, holdDescription, isLadderTier } from "@/lib/risk";

describe("TIER_RULES", () => {
  it("matches the hold windows HANDOFF.md §6.1 specifies", () => {
    // If this test is ever "fixed" to match the code, check §6.1 first. The
    // payout pipeline and this UI read the same table, so a wrong number here
    // is a promise the product then breaks.
    expect(TIER_RULES.NEW.holdHours).toBe(72);
    expect(TIER_RULES.STANDARD.holdHours).toBe(24);
    expect(TIER_RULES.TRUSTED.holdHours).toBeNull();
    expect(TIER_RULES.FLAGGED.holdHours).toBeNull();
  });

  it("describes FLAGGED as review, never as a ban", () => {
    expect(TIER_RULES.FLAGGED.meaning).toMatch(/still complete tasks/i);
  });
});

describe("TIER_LADDER", () => {
  it("runs slowest to fastest", () => {
    expect(TIER_LADDER).toEqual(["NEW", "STANDARD", "TRUSTED"]);
  });

  it("leaves FLAGGED off — it is a side state, not a rung", () => {
    expect(isLadderTier("FLAGGED")).toBe(false);
  });
});

describe("holdDescription", () => {
  it("says days once hours stop being readable", () => {
    expect(holdDescription("NEW")).toBe("3-day hold");
    expect(holdDescription("STANDARD")).toBe("1-day hold");
    expect(holdDescription("TRUSTED")).toBe("no hold");
  });
});
