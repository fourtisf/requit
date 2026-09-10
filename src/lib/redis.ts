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
    connectTimeout: 1_000,

    // `commandTimeout` is what bounds the wait, and its timer starts when the
    // command is queued — so a command issued during an outage rejects after a
    // second whether or not the socket ever opened.
    commandTimeout: 1_000,

    // The offline queue stays ON. Turning it off looks like the stricter
    // choice, but it also rejects commands issued in the milliseconds between
    // process start and the socket becoming ready — so the first sign-in after
    // every deploy fails with "Stream isn't writeable". commandTimeout already
    // covers the case that setting was meant to protect against.
    enableOfflineQueue: true,
    enableReadyCheck: true,
  });
  connection.on("error", (error) => console.error("[redis:kv]", error.message));

  if (process.env.NODE_ENV !== "production") globalForRedis.redisKv = connection;
  return connection;
}
