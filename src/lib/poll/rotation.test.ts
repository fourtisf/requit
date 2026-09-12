import { describe, expect, it } from "vitest";
import { QUESTIONS } from "@/lib/poll/questions";
import { dayIndex, questionFor } from "@/lib/poll/rotation";

function daysFrom(start: string, count: number): string[] {
  const first = Date.parse(`${start}T00:00:00.000Z`);
  return Array.from({ length: count }, (_unused, step) =>
    new Date(first + step * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

describe("the question of the day", () => {
  it("is the same question every time it is asked for a day", () => {
    for (const day of daysFrom("2026-09-12", 40)) {
      expect(questionFor(day).id).toBe(questionFor(day).id);
    }
  });

  it("asks every question once before repeating any", () => {
    const lap = daysFrom("2026-09-01", QUESTIONS.length).map((day) => questionFor(day).id);
    expect(new Set(lap).size).toBe(QUESTIONS.length);
  });

  it("does not repeat the same order on the next lap", () => {
    const first = daysFrom("2026-09-01", QUESTIONS.length).map((day) => questionFor(day).id);
    const start = new Date(Date.UTC(2026, 8, 1) + QUESTIONS.length * 86_400_000);
    const second = daysFrom(start.toISOString().slice(0, 10), QUESTIONS.length).map(
      (day) => questionFor(day).id,
    );
    expect(new Set(second).size).toBe(QUESTIONS.length);
    expect(second).not.toEqual(first);
  });

  it("never asks the same question two days running", () => {
    const days = daysFrom("2026-09-01", 120).map((day) => questionFor(day).id);
    for (let index = 1; index < days.length; index += 1) {
      expect(days[index]).not.toBe(days[index - 1]);
    }
  });

  it("still returns a question for a day before the epoch", () => {
    expect(dayIndex("2026-08-30")).toBeLessThan(0);
    expect(QUESTIONS.map((question) => question.id)).toContain(questionFor("2026-08-30").id);
  });
});

describe("the bank itself", () => {
  it("has no duplicate ids, because an answer stores one", () => {
    expect(new Set(QUESTIONS.map((question) => question.id)).size).toBe(QUESTIONS.length);
    for (const question of QUESTIONS) {
      const ids = question.options.map((option) => option.id);
      expect(new Set(ids).size, `${question.id} has a duplicate option id`).toBe(ids.length);
    }
  });

  it("gives every question at least two options and a stated use", () => {
    for (const question of QUESTIONS) {
      expect(question.options.length, question.id).toBeGreaterThanOrEqual(2);
      expect(question.use.length, question.id).toBeGreaterThan(20);
    }
  });

  it("never promises the answer is worth money", () => {
    // The same rule the readiness list is held to: no task on this site pays
    // today, and a question that hints otherwise is the lie that costs most.
    const money = /\b(earn|paid for|reward|bonus|points|credit)\b/i;
    for (const question of QUESTIONS) {
      expect(money.test(question.ask), `${question.id}: ${question.ask}`).toBe(false);
    }
  });
});
