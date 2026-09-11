import { describe, expect, it } from "vitest";
import { completionRate, DEAD_TIER_RATE, MIN_SAMPLES } from "@/lib/offers";

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
