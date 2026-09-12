import type { Prisma } from "@prisma/client";

/**
 * Money, always in USD, always to the cent.
 *
 * Takes a Prisma.Decimal rather than a number on purpose: the amounts are
 * Decimal(10,4) in the database, and routing them through a float to format
 * them reintroduces exactly the rounding error the column type exists to
 * prevent. `toFixed` on a Decimal is exact.
 */
export function money(amount: Prisma.Decimal): string {
  return `$${amount.toFixed(2)}`;
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/**
 * A small number, written out.
 *
 * For prose, where "6 games" reads like a spreadsheet and "six games" reads
 * like a sentence. Money and dates never use this — a figure is a figure, and
 * every one of those on this site has to be checkable against a query.
 */
export function spell(count: number): string {
  return WORDS[count] ?? String(count);
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * Timestamps are rendered in UTC, with the zone written out.
 *
 * Not the viewer's locale: an operator and a member comparing the same
 * withdrawal across two timezones is how a 24-hour hold turns into an argument.
 */
export function stamp(when: Date): string {
  return `${DATE.format(when)} UTC`;
}

export function relative(when: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - when.getTime()) / 1000);
  const future = seconds < 0;
  const abs = Math.abs(seconds);

  const [value, unit] =
    abs < 60
      ? [abs, "second"]
      : abs < 3600
        ? [Math.round(abs / 60), "minute"]
        : abs < 86_400
          ? [Math.round(abs / 3600), "hour"]
          : [Math.round(abs / 86_400), "day"];

  const plural = value === 1 ? unit : `${unit}s`;
  return future ? `in ${value} ${plural}` : `${value} ${plural} ago`;
}
