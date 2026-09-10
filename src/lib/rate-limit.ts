import { redis } from "@/lib/redis";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window counter in Redis.
 *
 * Good enough for the sign-in path, which is what it exists for: an unlimited
 * OTP endpoint is both a mail-cost problem and a way to grind codes. It is NOT
 * good enough for the public proof endpoints in HANDOFF.md §8 — those want a
 * sliding window; revisit in Phase 4.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const connection = redis();
  const redisKey = `ratelimit:${key}`;

  const count = await connection.incr(redisKey);
  if (count === 1) {
    await connection.expire(redisKey, windowSeconds);
  }

  const ttl = await connection.ttl(redisKey);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  };
}
