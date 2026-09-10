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
  console.error(`[worker] ${job?.name ?? "unknown"} failed:`, error);
});

async function main(): Promise<void> {
  await getQueue(QUEUE.maintenance).upsertJobScheduler(
    "heartbeat",
    { every: 60_000 },
    { name: "heartbeat" },
  );
  console.log("[worker] ready");
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} — draining`);
  await maintenance.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

void main();
