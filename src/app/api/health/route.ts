import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kv } from "@/lib/redis";
import { emailTransportConfigured } from "@/lib/auth/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; latencyMs: number; error?: string };

/**
 * Identifies the responder. A deploy that probes a port rather than an app will
 * go green whenever anything at all is listening — which is exactly what
 * happened on a box already running another service on 3000.
 */
const SERVICE = "requit";

/**
 * Liveness and readiness for PM2, Nginx and uptime monitoring.
 *
 * Returns 503 when a dependency is down so a load balancer takes the instance
 * out rather than serving errors. The body names which dependency failed but
 * carries no connection strings — this endpoint is unauthenticated.
 */
/**
 * A probe that hangs is worse than one that fails: the load balancer sees a
 * timeout instead of a clean 503 and keeps the instance in rotation.
 *
 * The probe uses `kv()`, which fails fast. The timeout is still here as the
 * backstop: it also covers Postgres, and it bounds the response even if the
 * connection settings are changed later.
 */
const CHECK_TIMEOUT_MS = 2_000;

export async function GET(): Promise<NextResponse> {
  const critical = await Promise.all([
    timed("database", async () => {
      await prisma.$queryRaw`SELECT 1`;
    }),
    timed("redis", async () => {
      await kv().ping();
    }),
  ]);

  // Mail is reported but does not decide the status. The site serves fine
  // without it; only sign-in breaks. Taking the instance out of rotation over a
  // mail problem would turn a broken sign-in into a broken site.
  //
  // This is the shape check, which costs nothing. The real SMTP handshake is in
  // the admin panel: running it on every probe would open a connection on every
  // deploy and every monitoring tick, which mail hosts rate-limit.
  const mailOk = emailTransportConfigured();
  const mail: Check = {
    name: "mail",
    ok: mailOk,
    latencyMs: 0,
    // No host, no username, no error text. This endpoint is unauthenticated and
    // the detail belongs where it can be acted on.
    ...(mailOk ? {} : { error: "sign-in codes cannot be sent" }),
  };

  const healthy = critical.every((check) => check.ok);
  const checks = [...critical, mail];

  return NextResponse.json(
    { service: SERVICE, status: healthy ? "ok" : "degraded", checks },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

async function timed(name: string, run: () => Promise<void>): Promise<Check> {
  const started = Date.now();

  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), CHECK_TIMEOUT_MS);
  });

  try {
    await Promise.race([run(), deadline]);
    return { name, ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.name : "unknown",
    };
  } finally {
    // The losing promise is abandoned, not cancelled — a queued Redis command
    // still settles later. Clearing the timer is what stops the process being
    // held open by it.
    clearTimeout(timer);
  }
}

class TimeoutError extends Error {
  override name = "TimeoutError";

  constructor() {
    super(`Check exceeded ${CHECK_TIMEOUT_MS}ms`);
  }
}
