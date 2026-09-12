import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { money, relative, spell, stamp } from "@/lib/format";

const d = (value: string) => new Prisma.Decimal(value);

describe("money", () => {
  it("always shows both cents", () => {
    expect(money(d("0"))).toBe("$0.00");
    expect(money(d("12"))).toBe("$12.00");
    expect(money(d("12.5"))).toBe("$12.50");
  });

  it("rounds a four-decimal amount to the cent without going through a float", () => {
    // 0.1 + 0.2 in binary floating point is 0.30000000000000004. The column is
    // Decimal(10,4) precisely so that cannot happen, and formatting must not
    // reintroduce it.
    expect(money(d("0.1").add(d("0.2")))).toBe("$0.30");
    expect(money(d("1234567.8949"))).toBe("$1234567.89");
    expect(money(d("0.0050"))).toBe("$0.01");
  });

  it("keeps a large balance exact", () => {
    // 9007199254740993 is not representable as a double.
    expect(money(d("9007199254740993.00"))).toBe("$9007199254740993.00");
  });
});

describe("stamp", () => {
  it("renders in UTC and says so", () => {
    // An operator in Jakarta and a member in London reading different times off
    // the same 24-hour hold is how a hold becomes an argument.
    expect(stamp(new Date("2026-09-11T06:53:00Z"))).toBe("11 Sept 2026, 06:53 UTC");
  });

  it("does not shift a timestamp near midnight", () => {
    expect(stamp(new Date("2026-01-01T00:30:00Z"))).toBe("01 Jan 2026, 00:30 UTC");
  });
});

describe("relative", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  const ago = (ms: number) => relative(new Date(now.getTime() - ms), now);

  it("picks a unit a person reads without doing arithmetic", () => {
    expect(ago(30_000)).toBe("30 seconds ago");
    expect(ago(90_000)).toBe("2 minutes ago");
    expect(ago(3 * 3600_000)).toBe("3 hours ago");
    expect(ago(50 * 3600_000)).toBe("2 days ago");
  });

  it("singularises", () => {
    expect(ago(1000)).toBe("1 second ago");
    expect(ago(60_000)).toBe("1 minute ago");
    expect(ago(24 * 3600_000)).toBe("1 day ago");
  });

  it("handles a future time, which a hold window is", () => {
    expect(relative(new Date(now.getTime() + 3600_000), now)).toBe("in 1 hour");
    expect(relative(new Date(now.getTime() + 72 * 3600_000), now)).toBe("in 3 days");
  });
});

describe("spelling a small number", () => {
  it("writes the ones out", () => {
    // "6 games" reads like a spreadsheet; "six games" reads like a sentence.
    expect(spell(0)).toBe("no");
    expect(spell(1)).toBe("one");
    expect(spell(6)).toBe("six");
    expect(spell(10)).toBe("ten");
  });

  it("gives up past ten rather than inventing grammar", () => {
    expect(spell(11)).toBe("11");
    expect(spell(48)).toBe("48");
  });
});
