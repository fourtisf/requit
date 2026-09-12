import { describe, expect, it } from "vitest";
import { GAME_SLUGS } from "@/lib/games/catalog";
import { DISALLOWED, PUBLIC_PATHS, sitemapEntries } from "@/lib/sitemap";

const ORIGIN = "https://requit.xyz";

function paths(): string[] {
  return sitemapEntries(ORIGIN).map((entry) => new URL(entry.url).pathname);
}

describe("sitemap", () => {
  it("lists every public page", () => {
    for (const path of PUBLIC_PATHS) expect(paths()).toContain(path);
  });

  it("lists every game, so a game added later is not left out by hand", () => {
    for (const slug of GAME_SLUGS) expect(paths()).toContain(`/play/${slug}`);
    expect(paths()).toHaveLength(PUBLIC_PATHS.length + GAME_SLUGS.length);
  });

  it("gives absolute URLs on the configured origin", () => {
    for (const entry of sitemapEntries(ORIGIN)) {
      expect(entry.url.startsWith(`${ORIGIN}/`)).toBe(true);
    }
  });

  it("offers nothing that robots.txt blocks", () => {
    // The point of keeping both lists in one module. A page submitted and then
    // blocked is the signature of a site nobody maintains.
    for (const path of paths()) {
      const blocked = DISALLOWED.filter((rule) =>
        rule.endsWith("/") ? path.startsWith(rule) : path === rule || path.startsWith(`${rule}/`),
      );
      expect(blocked, `${path} is disallowed by ${blocked.join(", ")}`).toEqual([]);
    }
  });

  it("keeps signed-in pages out entirely", () => {
    for (const path of paths()) {
      expect(path).not.toMatch(/^\/(dashboard|settings|withdraw|tasks|disputes|admin|signin)/);
    }
  });

  it("never carries a lastModified date it cannot substantiate", () => {
    for (const entry of sitemapEntries(ORIGIN)) {
      expect(entry).not.toHaveProperty("lastModified");
    }
  });
});
