import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The site is in English, and stays in English until it is translated properly.
 *
 * This is here because the people building it do not all think in English, and
 * a single sentence in another language does not look bilingual — it looks like
 * a page assembled by two different products, on a site whose entire pitch is
 * that it is careful. Translating the whole site is a real piece of work with
 * its own routing, its own copy review and its own legal text; half of it
 * arriving by accident is the thing to prevent.
 *
 * The word list is deliberately short and unambiguous: common Indonesian
 * function words that cannot appear inside English copy. Names of languages
 * ("Bahasa Indonesia" as an option a member can pick) are not on it, because
 * naming a language in English is English.
 */

const ROOT = join(process.cwd(), "src");

const FOREIGN = [
  "anda",
  "kami",
  "tidak",
  "untuk",
  "dengan",
  "adalah",
  "yang",
  "sudah",
  "belum",
  "silakan",
  "jangan",
  "gratis",
  "pengguna",
  "tugas",
  "hadiah",
];

function sourceFiles(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (!/\.(tsx|ts)$/.test(entry)) continue;
    // Tests describe behaviour, including this one, and this file names every
    // word it is looking for.
    if (/\.test\.tsx?$/.test(entry)) continue;
    out.push(path);
  }
  return out;
}

describe("the site's copy", () => {
  it("is in English, everywhere", () => {
    const pattern = new RegExp(`\\b(${FOREIGN.join("|")})\\b`, "i");
    const offenders: string[] = [];

    for (const path of sourceFiles(ROOT)) {
      const lines = readFileSync(path, "utf8").split("\n");
      lines.forEach((line, index) => {
        const found = pattern.exec(line);
        if (found) offenders.push(`${path.replace(process.cwd(), ".")}:${index + 1} — "${found[1]}"`);
      });
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
