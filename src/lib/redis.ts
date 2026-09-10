import IORedis from "ioredis";
import { serverEnv } from "@/lib/env";

const globalForRedis = globalThis as unknown as { redis?: IORedis };

/**
 * Shared connection for BullMQ.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ — with a retry limit the
 * blocking commands its workers rely on error out instead of waiting.
 */
export function redis(): IORedis {
  if (globalForRedis.redis) return globalForRedis.redis;

  const connection = new IORedis(serverEnv().REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = connection;
  }

  return connection;
}
