import { describe, expect, it } from "vitest";
import { REWARDED_SPECS, canEarn, canEarnFromGames, earningsStatus } from "@/lib/ads/rewarded";

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

describe("who a round could be credited to", () => {
  const paying = { earning: true, network: "ADMOB" } as const;

  it("refuses everyone today, on the network rather than on the player", () => {
    // With no network there is no money, so the reason is the same whether or
    // not anyone is signed in. Saying "sign in to earn" while nothing pays
    // would be selling an account on a promise we are not keeping.
    expect(canEarn(null)).toEqual({ earning: false, reason: "no-network" });
    expect(canEarn({ signedIn: true })).toEqual({ earning: false, reason: "no-network" });
    expect(canEarnFromGames()).toBe(false);
  });

  it("refuses a visitor even once a network is paying", () => {
    // A credit is a row against a user id, and a visitor has no user id:
    // nothing is written down while they play, so there is nobody to owe
    // afterwards. The game stays free; the claim is what needs an account.
    expect(canEarn(null, paying)).toEqual({ earning: false, reason: "signed-out" });
    expect(canEarn({ signedIn: false }, paying)).toEqual({
      earning: false,
      reason: "signed-out",
    });
  });

  it("refuses a suspended account, which is told why elsewhere", () => {
    expect(canEarn({ signedIn: true, suspended: true }, paying)).toEqual({
      earning: false,
      reason: "suspended",
    });
  });

  it("credits a signed-in member once, and only once, both are true", () => {
    expect(canEarn({ signedIn: true }, paying)).toEqual({ earning: true, network: "ADMOB" });
    expect(canEarn({ signedIn: true, suspended: false }, paying)).toEqual({
      earning: true,
      network: "ADMOB",
    });
  });
});
