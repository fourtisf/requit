import type { MetadataRoute } from "next";
import { DISALLOWED, indexingAllowed } from "@/lib/sitemap";

/**
 * Indexing is opt-in per deployment (NEXT_PUBLIC_ALLOW_INDEXING), so staging
 * cannot be indexed by forgetting something. Production sets it to "true".
 *
 * The disallow list and the sitemap come from the same module, because the
 * failure worth preventing is the two drifting apart — see lib/sitemap.ts.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!indexingAllowed()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...DISALLOWED] }],
    sitemap: new URL("/sitemap.xml", origin).toString(),
    host: new URL(origin).host,
  };
}
