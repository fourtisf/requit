import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";

const ROOT = join(import.meta.dirname, "..", "..");
const SEARCHED = ["src", "prisma"];
const SKIP_FILES = new Set([join("src", "lib", "brand.ts"), join("src", "lib", "brand.test.ts")]);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      yield full;
    }
  }
}

/**
 * HANDOFF.md §0.1: the brand name is a placeholder and swapping it must be one
 * edit. This test is the enforcement — without it the name creeps back into copy
 * and email templates, and the swap becomes a grep-and-pray.
 */
describe("brand", () => {
  it("is not hardcoded outside lib/brand.ts", () => {
    const offenders: string[] = [];

    for (const dir of SEARCHED) {
      for (const file of walk(join(ROOT, dir))) {
        const relative = file.slice(ROOT.length + 1);
        if (SKIP_FILES.has(relative)) continue;

        const contents = readFileSync(file, "utf8");
        // Seed data and comments are allowed to name the file, not the brand.
        const lines = contents.split("\n").filter((line) => {
          if (!line.includes(BRAND.name)) return false;
          const trimmed = line.trimStart();
          return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
        });

        if (lines.length > 0) offenders.push(`${relative}: ${lines[0]?.trim()}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("exposes every field the templates need", () => {
    expect(BRAND.name).toBeTruthy();
    expect(BRAND.domain).toContain(".");
    expect(BRAND.supportEmail).toContain("@");
    expect(BRAND.ticker).toMatch(/^[A-Z]{2,6}$/);
  });
});
