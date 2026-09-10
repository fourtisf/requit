/**
 * Background worker process. Run separately from the web process:
 *
 *   npm run worker
 *
 * Phase 0 registers only a heartbeat so the queue wiring is demonstrably alive.
 * Offer sync lands here in Phase 1; the payout executor and the reconciliation
 * job in Phase 2.
 */
// Standalone process — nothing loads .env for us the way Next does for the app.
import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { QUEUE, getQueue } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { alert } from "@/lib/alert";
import { initSentry, Sentry } from "@/lib/observability";

initSentry();

const connection = redis();

const maintenance = new Worker(
  QUEUE.maintenance,
  async (job: Job) => {
    if (job.name === "heartbeat") {
      return { at: new Date().toISOString() };
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
  console.log("[worker] ready");
}

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[worker] ${signal} — draining`);
  // `close()` waits for in-flight jobs. From Phase 2 an in-flight job may have
  // broadcast a transaction, so killing it mid-flight is a reconciliation
  // problem rather than a restart.
  await maintenance.close();
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
