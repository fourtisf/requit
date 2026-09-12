import { describe, expect, it } from "vitest";
import { below, rng, shuffle } from "@/lib/games/rng";

describe("the seeded generator", () => {
  it("gives the same stream for the same seed", () => {
    // Everything downstream rests on this: it is what lets the server replay a
    // browser's game and get the same board.
    const a = rng(12345);
    const b = rng(12345);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("gives a different stream for a different seed", () => {
    expect(rng(1)()).not.toBe(rng(2)());
  });

  it("stays inside [0, 1)", () => {
    const next = rng(99);
    for (let index = 0; index < 500; index += 1) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads across the range rather than sitting in one corner", () => {
    // A generator that clustered would deal every game the same board and take
    // the shuffle out of the shuffle.
    const next = rng(7);
    const buckets = new Array<number>(10).fill(0);
    for (let index = 0; index < 10_000; index += 1) buckets[Math.floor(next() * 10)]! += 1;
    for (const count of buckets) expect(count).toBeGreaterThan(700);
  });
});

describe("drawing an integer", () => {
  it("stays inside the bound", () => {
    const next = rng(3);
    for (let index = 0; index < 500; index += 1) {
      const value = below(6, next);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
    }
  });

  it("reaches both ends", () => {
    const next = rng(3);
    const seen = new Set<number>();
    for (let index = 0; index < 500; index += 1) seen.add(below(4, next));
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe("shuffling", () => {
  const deck = [0, 1, 2, 3, 4, 5, 6, 7];

  it("keeps every card, once", () => {
    expect([...shuffle(deck, rng(1))].sort((a, b) => a - b)).toEqual(deck);
  });

  it("leaves the original alone", () => {
    const original = [...deck];
    shuffle(deck, rng(1));
    expect(deck).toEqual(original);
  });

  it("deals the same order for the same seed", () => {
    expect(shuffle(deck, rng(42))).toEqual(shuffle(deck, rng(42)));
    expect(shuffle(deck, rng(42))).not.toEqual(shuffle(deck, rng(43)));
  });

  it("can put any card in any position", () => {
    // Fisher-Yates done wrong leaves a card unable to reach some slot, which is
    // the kind of bias nobody notices until a memory game feels rigged.
    const seen = deck.map(() => new Set<number>());
    for (let seed = 1; seed <= 400; seed += 1) {
      shuffle(deck, rng(seed)).forEach((card, position) => seen[card]!.add(position));
    }
    for (const positions of seen) expect(positions.size).toBe(deck.length);
  });
});
