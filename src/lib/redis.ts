import IORedis from "ioredis";
import { serverEnv } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
  redisQueue?: IORedis;
  redisKv?: IORedis;
};

/**
 * Connection for BullMQ.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ — with a retry limit the
 * blocking commands its workers rely on error out instead of waiting. That same
 * setting makes this connection unusable on a request path: while Redis is down
 * a command QUEUES rather than failing, so the caller waits forever. Anything
 * serving an HTTP request wants `kv()` below.
 */
export function redis(): IORedis {
  if (globalForRedis.redisQueue) return globalForRedis.redisQueue;

  const connection = new IORedis(serverEnv().REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  connection.on("error", (error) => console.error("[redis:queue]", error.message));

  if (process.env.NODE_ENV !== "production") globalForRedis.redisQueue = connection;
  return connection;
}

/**
 * Connection for everything on a request path — rate limiting, health checks.
 *
 * Configured to fail fast rather than wait. A Redis outage should turn into a
 * refused sign-in and a red health check within a second or two, not into
 * request handlers piling up until the process runs out of sockets.
 */
export function kv(): IORedis {
  if (globalForRedis.redisKv) return globalForRedis.redisKv;

  const connection = new IORedis(serverEnv().REDIS_URL, {
    maxRetriesPerRequest: 1,
    commandTimeout: 1_000,
    connectTimeout: 1_000,
    // Without this, commands issued while the socket is down are buffered and
    // resolve much later — which is the hang this connection exists to avoid.
    enableOfflineQueue: false,
    enableReadyCheck: true,
  });
  connection.on("error", (error) => console.error("[redis:kv]", error.message));

  if (process.env.NODE_ENV !== "production") globalForRedis.redisKv = connection;
  return connection;
}
