import { describe, expect, it } from "vitest";
import { winnersOf } from "@/lib/poll/calls";

describe("who won a day", () => {
  it("is the option most people picked", () => {
    expect(
      winnersOf([
        { optionId: "a", count: 3 },
        { optionId: "b", count: 7 },
        { optionId: "c", count: 1 },
      ]),
    ).toEqual(["b"]);
  });

  it("is everyone tied at the top, because 'most people' is not true of a split", () => {
    expect(
      winnersOf([
        { optionId: "a", count: 4 },
        { optionId: "b", count: 4 },
        { optionId: "c", count: 1 },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("is nobody on a day nobody answered", () => {
    expect(winnersOf([])).toEqual([]);
    expect(winnersOf([{ optionId: "a", count: 0 }])).toEqual([]);
  });

  it("does not care what order the counts arrive in", () => {
    const rows = [
      { optionId: "a", count: 1 },
      { optionId: "b", count: 9 },
    ];
    expect(winnersOf(rows)).toEqual(winnersOf([...rows].reverse()));
  });
});
