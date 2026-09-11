/**
 * Background worker process. Run separately from the web process:
 *
 *   npm run worker
 *
 * Two queues, two failure domains (§2): maintenance keeps rewards maturing, and
 * payouts sends money. A stuck chain must not stop postbacks being credited, so
 * they do not share a worker.
 */
// Standalone process — nothing loads .env for us the way Next does for the app.
import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { QUEUE, getQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { notifyLiveCountries } from "@/lib/interest";
import { redis } from "@/lib/redis";
import { alert } from "@/lib/alert";
import { initSentry, Sentry } from "@/lib/observability";
import { schedulePayoutJobs, startPayoutWorker } from "@/worker/payouts";

initSentry();

const connection = redis();

// Built at start-up: the keystore is unlocked once, here, and nothing else in
// the process ever sees the raw key. A chain with no keystore configured is
// reported and skipped — the worker still runs.
const { worker: payouts } = startPayoutWorker(connection);

const maintenance = new Worker(
  QUEUE.maintenance,
  async (job: Job) => {
    if (job.name === "heartbeat") {
      return { at: new Date().toISOString() };
    }

    if (job.name === "mature-rewards") {
      // §4.2 step 5: a background job flips PENDING to AVAILABLE once
      // availableAt passes. Nothing else may do it — a reward that matures on
      // read would become available at different moments for different callers.
      const { count } = await prisma.reward.updateMany({
        where: { status: "PENDING", availableAt: { lte: new Date() } },
        data: { status: "AVAILABLE" },
      });
      return { matured: count };
    }

    if (job.name === "notify-live-countries") {
      // Batched, so one newly-opened country cannot put thousands of messages
      // into the mail queue in a single tick.
      return notifyLiveCountries();
    }

    throw new Error(`Unknown maintenance job: ${job.name}`);
  },
  { connection, concurrency: 1 },
);

maintenance.on("failed", (job, error) => {
  Sentry.captureException(error, { tags: { queue: QUEUE.maintenance, job: job?.name } });

  // Only alert once a job has burned its retries. Alerting on the first attempt
  // trains ALFA to ignore the channel, and from Phase 2 this channel carries
  // payout failures.
  const exhausted = !job || job.attemptsMade >= (job.opts.attempts ?? 1);
  if (!exhausted) return;

  void alert({
    severity: "critical",
    title: `Job failed after ${job?.attemptsMade ?? 0} attempts`,
    detail: error.message,
    context: { queue: QUEUE.maintenance, job: job?.name ?? "unknown", id: job?.id ?? "unknown" },
  });
});

maintenance.on("error", (error) => {
  // Connection-level trouble, not a job. Usually Redis.
  console.error("[worker] queue error:", error);
  Sentry.captureException(error, { tags: { queue: QUEUE.maintenance, scope: "connection" } });
});

async function main(): Promise<void> {
  await getQueue(QUEUE.maintenance).upsertJobScheduler(
    "heartbeat",
    { every: 60_000 },
    { name: "heartbeat" },
  );
  await getQueue(QUEUE.maintenance).upsertJobScheduler(
    "mature-rewards",
    { every: 60_000 },
    { name: "mature-rewards" },
  );

  await getQueue(QUEUE.maintenance).upsertJobScheduler(
    "notify-live-countries",
    { every: 5 * 60_000 },
    { name: "notify-live-countries" },
  );

  await schedulePayoutJobs();

  console.log("[worker] ready");
}

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[worker] ${signal} — draining`);
  // `close()` waits for in-flight jobs. A payout job may have broadcast a
  // transaction and not yet written the hash, so killing it mid-flight turns a
  // restart into a reconciliation problem. Wait for it.
  await Promise.all([maintenance.close(), payouts.close()]);
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandled rejection:", reason);
  Sentry.captureException(reason);
});

void main();
