import { describe, expect, it } from "vitest";
import { REWARDED_SPECS, canEarnFromGames, earningsStatus } from "@/lib/ads/rewarded";

describe("the rewarded-ad gate", () => {
  it("has no confirmed network, so no game credits anyone", () => {
    // The same guard the postback signature specs carry. Crediting a member for
    // an ad nobody paid for means the company funding its own rewards out of
    // the float, which is the arrangement this product exists to not be.
    for (const [network, spec] of Object.entries(REWARDED_SPECS)) {
      expect(spec.confirmed, network).toBe(false);
    }
  });

  it("reports not-earning, with the reason", () => {
    expect(earningsStatus()).toEqual({ earning: false, reason: "no-network" });
    expect(canEarnFromGames()).toBe(false);
  });
});
