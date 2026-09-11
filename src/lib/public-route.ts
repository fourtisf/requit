import type { NextRequest } from "next/server";
import { kv } from "@/lib/redis";
import { rateLimitAll } from "@/lib/rate-limit";
import { clientIp, hashIp } from "@/lib/request-ip";
import { Sentry } from "@/lib/observability";

/**
 * The shared shape of §8's four endpoints: cached 60 seconds, rate limited.
 *
 * The cache is in Redis rather than per-process because these are the numbers
 * the marketing site quotes — two processes serving different figures for the
 * same second is exactly the inconsistency the section is trying to prevent.
 */
const TTL_SECONDS = 60;

export async function publicJson(
  request: NextRequest,
  key: string,
  compute: () => Promise<unknown>,
): Promise<Response> {
  const ip = clientIp(request.headers);
  const limit = await rateLimitAll([
    { key: `public:${ip ? hashIp(ip) : "anon"}`, limit: 120, windowSeconds: 60 },
  ]);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests." }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "60" },
    });
  }

  const cacheKey = `public:cache:${key}`;

  try {
    const cached = await kv().get(cacheKey);
    if (cached) return json(cached, true);
  } catch (error) {
    // Redis being down must not take the public proof pages with it. Fall
    // through and compute.
    Sentry.captureException(error, { tags: { route: "public", stage: "cache-read" } });
  }

  const payload = JSON.stringify(await compute());

  try {
    await kv().set(cacheKey, payload, "EX", TTL_SECONDS);
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "public", stage: "cache-write" } });
  }

  return json(payload, false);
}

function json(body: string, hit: boolean): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Public data, so a CDN or the browser may hold it for the same minute.
      "cache-control": `public, max-age=${TTL_SECONDS}, stale-while-revalidate=30`,
      "x-cache": hit ? "hit" : "miss",
    },
  });
}
