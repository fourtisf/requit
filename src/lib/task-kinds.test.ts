import { describe, expect, it } from "vitest";
import { OfferCategory } from "@prisma/client";
import { TASK_KINDS, TASK_KIND_ORDER } from "@/lib/task-kinds";

const CATEGORIES = Object.values(OfferCategory);

describe("task kinds", () => {
  it("describes every category the schema can produce", () => {
    // A category added to the enum without a description here would render as a
    // blank card on the public page. Failing the build is the cheaper outcome.
    expect(Object.keys(TASK_KINDS).sort()).toEqual([...CATEGORIES].sort());
  });

  it("renders every category exactly once", () => {
    expect([...TASK_KIND_ORDER].sort()).toEqual([...CATEGORIES].sort());
    expect(new Set(TASK_KIND_ORDER).size).toBe(TASK_KIND_ORDER.length);
  });

  it("carries no figures", () => {
    // §8: every number this product shows comes from a query over real rows. An
    // illustrative reward on a marketing page is a number nobody can check, on
    // a product whose argument is that you can check the numbers.
    const digits = /\d/;
    for (const [category, kind] of Object.entries(TASK_KINDS)) {
      const text = [kind.title, kind.body, kind.paidWhen, kind.caveat ?? ""].join(" ");
      expect(digits.test(text), `${category} mentions a figure`).toBe(false);
    }
  });

  it("says when payment is released, for every kind", () => {
    // "You get paid" without the condition is the sentence people remember and
    // then dispute. Each kind names the event that releases the money.
    for (const [category, kind] of Object.entries(TASK_KINDS)) {
      expect(kind.paidWhen.trim().length, category).toBeGreaterThan(10);
      expect(kind.body.trim().length, category).toBeGreaterThan(40);
    }
  });

  it("warns about the two kinds that can cost someone", () => {
    // A survey can screen you out after ten minutes for nothing, and a shopping
    // offer needs your own money first. Both must be said before someone
    // starts, not after.
    expect(TASK_KINDS.SURVEY.caveat).toBeDefined();
    expect(TASK_KINDS.SHOPPING.caveat).toBeDefined();
  });
});
