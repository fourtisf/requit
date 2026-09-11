import { describe, expect, it } from "vitest";
import {
  byEase,
  completionRate,
  DEAD_TIER_RATE,
  easeOf,
  EASY_RATE,
  MIN_SAMPLES,
  MODERATE_RATE,
  parseSort,
  type OfferView,
  type TierView,
} from "@/lib/offers";

describe("completionRate", () => {
  it("is null below the sample floor", () => {
    // §4.4: "Never show a rate derived from a handful of samples." A tier that
    // two of three people reached is not a 67% tier.
    expect(completionRate(2, 3)).toBeNull();
    expect(completionRate(29, MIN_SAMPLES - 1)).toBeNull();
  });

  it("computes once there are enough samples", () => {
    expect(completionRate(15, 30)).toBe(0.5);
    expect(completionRate(1, 100)).toBe(0.01);
  });

  it("is zero, not null, when nobody reached a well-sampled tier", () => {
    // The difference matters: null hides the row, zero strikes it through.
    expect(completionRate(0, 200)).toBe(0);
  });

  it("marks a tier below 5% as one people do not reach", () => {
    expect(completionRate(4, 100)! < DEAD_TIER_RATE).toBe(true);
    expect(completionRate(5, 100)! < DEAD_TIER_RATE).toBe(false);
  });
});

describe("how hard an offer is", () => {
  const tier = (completionRate: number | null, sequence = 1): TierView => ({
    id: `t${sequence}`,
    sequence,
    label: `Tier ${sequence}`,
    userPays: "1",
    completionRate,
    starts: completionRate === null ? 3 : 500,
    unreachable: completionRate !== null && completionRate < DEAD_TIER_RATE,
  });

  it("reads the first tier, not the headline one", () => {
    // Headline tiers are designed to be rare. Judging an offer by its deepest
    // tier would call every offer in the catalogue hard, which tells nobody
    // anything — the question is whether you get *something* out of it.
    expect(easeOf([tier(0.8, 1), tier(0.02, 2)]).ease).toBe("easy");
  });

  it("bands on the thresholds", () => {
    expect(easeOf([tier(EASY_RATE)]).ease).toBe("easy");
    expect(easeOf([tier(EASY_RATE - 0.01)]).ease).toBe("moderate");
    expect(easeOf([tier(MODERATE_RATE)]).ease).toBe("moderate");
    expect(easeOf([tier(MODERATE_RATE - 0.01)]).ease).toBe("hard");
  });

  it("says nothing when there is not enough data, rather than guessing", () => {
    // Null is not "moderate". A badge derived from four people is worse than no
    // badge, because someone acts on it.
    expect(easeOf([tier(null)])).toEqual({ ease: null, entryRate: null });
    expect(easeOf([])).toEqual({ ease: null, entryRate: null });
  });
});

describe("ordering the list", () => {
  const offer = (id: string, entryRate: number | null, userPays: string): OfferView => ({
    id,
    network: "TOROX",
    name: id,
    description: null,
    category: "GAME",
    userPays,
    requiresPurchase: false,
    purchaseAmount: null,
    deadlineDays: null,
    devices: [],
    tiers: [],
    ease: null,
    entryRate,
  });

  it("leads with what people finish", () => {
    const list = [offer("hard", 0.05, "40"), offer("easy", 0.7, "3")];
    expect([...list].sort(byEase).map((o) => o.id)).toEqual(["easy", "hard"]);
  });

  it("puts offers nobody has measured after the measured ones", () => {
    // A brand-new offer has no claim on the top of the list.
    const list = [offer("unknown", null, "50"), offer("known", 0.3, "5")];
    expect([...list].sort(byEase).map((o) => o.id)).toEqual(["known", "unknown"]);
  });

  it("falls back to reward when nothing is measured", () => {
    // The state the catalogue is in on day one. It must look like the ordering
    // the page always had, not like it was shuffled.
    const list = [offer("small", null, "2"), offer("big", null, "90")];
    expect([...list].sort(byEase).map((o) => o.id)).toEqual(["big", "small"]);
  });

  it("breaks a tie on reward", () => {
    const list = [offer("lean", 0.5, "4"), offer("rich", 0.5, "22")];
    expect([...list].sort(byEase).map((o) => o.id)).toEqual(["rich", "lean"]);
  });

  it("only ever reorders by ease when asked", () => {
    expect(parseSort(undefined)).toBe("ease");
    expect(parseSort("reward")).toBe("reward");
    expect(parseSort("nonsense")).toBe("ease");
  });
});
