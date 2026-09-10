import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Client IP, in the order the deployment actually supplies it.
 *
 * `cf-connecting-ip` is set by Cloudflare and cannot be forged by the client,
 * because Cloudflare overwrites it. `x-forwarded-for` CAN be forged if a request
 * ever reaches the app without passing the proxy, so it is only a fallback and
 * only its first hop is read.
 *
 * HANDOFF.md §1 puts the app behind Cloudflare and Nginx. If that ever changes,
 * revisit this before trusting it for anything but rate limiting.
 */
const HEADER_CANDIDATES = ["cf-connecting-ip", "true-client-ip", "x-real-ip"] as const;

export function clientIp(headers: Headers): string | null {
  for (const name of HEADER_CANDIDATES) {
    const value = headers.get(name)?.trim();
    if (value) return value;
  }

  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || null;
}

/**
 * Stable, non-reversible identifier for an IP.
 *
 * Used as the `Device.ipHash` column and as a rate-limit key. Salted with
 * AUTH_SECRET so a leaked database cannot be brute-forced back to addresses —
 * the IPv4 space is small enough to enumerate against an unsalted hash in
 * minutes.
 */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${serverEnv().AUTH_SECRET}:${ip}`).digest("hex").slice(0, 32);
}
