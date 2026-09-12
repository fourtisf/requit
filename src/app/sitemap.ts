import type { MetadataRoute } from "next";
import { indexingAllowed, sitemapEntries } from "@/lib/sitemap";

/**
 * /sitemap.xml — the list a crawler reads instead of guessing.
 *
 * Empty when this deployment is not meant to be indexed, matching robots.ts:
 * the two files disagreeing is how a staging box ends up in a search result.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!indexingAllowed()) return [];
  return sitemapEntries(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}
