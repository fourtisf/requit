import type { NextConfig } from "next";

/**
 * Headers that do not vary per request. The Content-Security-Policy is NOT here:
 * it carries a per-request nonce and is set in src/middleware.ts.
 */
const securityHeaders = [
  // HSTS. Two years, subdomains included, preload-eligible. Only ever sent over
  // HTTPS by the browser's own rules, so it is inert in local development.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // frame-ancestors in the CSP is the real control; this covers browsers that
  // still only honour the older header.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing in this product needs any of these. A compromised dependency asking
  // for the camera should be refused by the platform, not by review.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  serverExternalPackages: ["bullmq", "ioredis", "nodemailer"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Staging and preview deployments must never be indexed: a proof page
        // full of test payouts ranking in search is a credibility problem that
        // outlives the deployment.
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value:
              process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true"
                ? "index, follow"
                : "noindex, nofollow",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
