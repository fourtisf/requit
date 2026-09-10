import type { MetadataRoute } from "next";

/**
 * Indexing is opt-in per deployment (NEXT_PUBLIC_ALLOW_INDEXING), so staging
 * cannot be indexed by forgetting something. Production sets it to "true".
 */
export default function robots(): MetadataRoute.Robots {
  const allowed = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

  return {
    rules: allowed
      ? [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/settings"] }]
      : [{ userAgent: "*", disallow: "/" }],
  };
}
