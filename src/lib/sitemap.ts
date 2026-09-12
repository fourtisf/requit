import { GAME_SLUGS } from "@/lib/games/catalog";

/**
 * What a search engine is told exists, and what it is told to leave alone.
 *
 * Both halves live here rather than in the two route files so the one rule that
 * matters can be tested: nothing offered in the sitemap may be disallowed in
 * robots.txt. A site that submits a page and then blocks it is not penalised,
 * but it is read by every crawler as a site nobody is maintaining — and this
 * one is asking strangers to trust it with a payout address.
 */

/** Pages a signed-out visitor can actually read. */
export const PUBLIC_PATHS = [
  "/",
  "/play",
  "/proof",
  "/leaderboard",
  "/terms",
  "/reward-policy",
  "/privacy",
] as const;

/**
 * Paths that are never useful in a result page.
 *
 * The signed-in routes redirect to /signin anyway, so this is not a security
 * boundary — it is there so the crawl budget is not spent on redirects and so
 * a search for the brand does not return a login screen. /admin is listed for
 * the same reason and is gated three more times behind this.
 */
export const DISALLOWED = [
  "/api/",
  "/admin",
  "/dashboard",
  "/settings",
  "/withdraw",
  "/tasks",
  "/disputes",
  "/history",
  "/referrals",
  "/signin",
  "/unsubscribe/",
] as const;

export type SitemapEntry = { url: string };

/**
 * Every public URL, absolute.
 *
 * The game pages are derived from the catalog rather than listed, so a game
 * added next month is in the sitemap the day it ships — the shelf already
 * counts itself, and this is the same rule.
 *
 * Deliberately no `lastModified`. We do not record when a page's content last
 * changed, and stamping every entry with the time of the request tells a
 * crawler the whole site changed on every fetch, which it learns to ignore.
 * An absent date is read as "unknown"; a wrong one is read once and discounted
 * from then on.
 */
export function sitemapEntries(origin: string): SitemapEntry[] {
  const paths = [...PUBLIC_PATHS, ...GAME_SLUGS.map((slug) => `/play/${slug}`)];
  return paths.map((path) => ({ url: new URL(path, origin).toString() }));
}

/** Indexing is opt-in per deployment, so staging cannot be listed by omission. */
export function indexingAllowed(): boolean {
  return process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
}
