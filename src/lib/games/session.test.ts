import { describe, expect, it } from "vitest";
import { parseMoves } from "@/lib/games/session";
import { MAX_MOVES } from "@/lib/games/play";

describe("parsing a submitted move list", () => {
  it("accepts the four directions", () => {
    expect(parseMoves(["up", "down", "left", "right"])).toEqual(["up", "down", "left", "right"]);
  });

  it("accepts an empty round", () => {
    expect(parseMoves([])).toEqual([]);
  });

  it("refuses anything that is not a direction", () => {
    // One bad entry fails the whole round rather than being skipped. Dropping
    // it would score a game that differs from the one submitted.
    expect(parseMoves(["up", "sideways"])).toBeNull();
    expect(parseMoves(["up", 3])).toBeNull();
    expect(parseMoves(["up", null])).toBeNull();
    expect(parseMoves([["up"]])).toBeNull();
  });

  it("refuses something that is not a list", () => {
    expect(parseMoves("up")).toBeNull();
    expect(parseMoves({ 0: "up", length: 1 })).toBeNull();
    expect(parseMoves(null)).toBeNull();
    expect(parseMoves(undefined)).toBeNull();
  });

  it("refuses a list too long to replay", () => {
    expect(parseMoves(new Array<string>(MAX_MOVES + 1).fill("left"))).toBeNull();
    expect(parseMoves(new Array<string>(MAX_MOVES).fill("left"))).toHaveLength(MAX_MOVES);
  });
});
