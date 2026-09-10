import { kv } from "@/lib/redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimitRule = {
  key: string;
  limit: number;
  windowSeconds: number;
};

/**
 * Fixed-window counter in Redis.
 *
 * Good enough for the sign-in path, which is what it exists for. It is NOT good
 * enough for the public proof endpoints in HANDOFF.md §8 — those want a sliding
 * window; revisit in Phase 4.
 *
 * **This fails closed, and it fails fast.** If Redis is unreachable the call
 * throws within about a second and the caller refuses the request. Failing
 * closed is deliberate: the alternative is that a Redis outage silently removes
 * every limit from an endpoint that sends email and hands out credentials.
 * Failing fast matters just as much — it uses `kv()`, not the BullMQ
 * connection, because that one queues commands during an outage instead of
 * erroring, and the request would hang until the client gave up.
 *
 * It does mean Redis is a hard dependency of sign-in, which is why
 * /api/health reports on it.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const connection = kv();
  const redisKey = `ratelimit:${key}`;

  // One round trip. INCR creates the key at 1; EXPIRE is NX so a window that is
  // already running is never extended by a later request inside it.
  const [count, ttl] = (await connection
    .multi()
    .incr(redisKey)
    .expire(redisKey, windowSeconds, "NX")
    .ttl(redisKey)
    .exec()
    .then((replies) => {
      if (!replies) throw new Error("Redis transaction returned no replies");
      const incr = replies[0];
      const ttlReply = replies[2];
      if (incr?.[0]) throw incr[0];
      if (ttlReply?.[0]) throw ttlReply[0];
      return [Number(incr?.[1] ?? 0), Number(ttlReply?.[1] ?? windowSeconds)];
    })) as [number, number];

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}

/**
 * Applies every rule and reports the first that refuses.
 *
 * All rules are evaluated even after one fails, so a caller hitting two limits
 * at once has both counters advanced — otherwise the second limit only starts
 * counting once the attacker stops tripping the first.
 */
export async function rateLimitAll(rules: RateLimitRule[]): Promise<RateLimitResult> {
  const results = await Promise.all(
    rules.map((rule) => rateLimit(rule.key, rule.limit, rule.windowSeconds)),
  );

  const refused = results.find((result) => !result.allowed);
  if (refused) return refused;

  return results.reduce((tightest, result) =>
    result.remaining < tightest.remaining ? result : tightest,
  );
}
