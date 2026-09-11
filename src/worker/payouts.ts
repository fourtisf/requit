import { Worker, type Job } from "bullmq";
import type IORedis from "ioredis";
import { QUEUE, getQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { alert } from "@/lib/alert";
import { Sentry } from "@/lib/observability";
import { executeWithdrawal, releaseMaturedHolds, settleWithdrawal } from "@/lib/payout/execute";
import { checkFloat, reconcile } from "@/lib/payout/reconcile";
import { loadWallets, type WalletSet } from "@/lib/payout/wallets";

/**
 * The payout queue. §6.2.
 *
 * On its own queue, per §2, so that a stuck chain cannot stop postbacks being
 * credited — and so that concurrency here can be 1 while the rest of the system
 * runs at whatever it likes. One at a time is deliberate: every extra worker is
 * another way for two processes to reason about the same hot wallet nonce.
 */

/** How many APPROVED withdrawals one sweep will send. */
const BATCH = 20;

export function startPayoutWorker(connection: IORedis): {
  worker: Worker;
  wallets: WalletSet;
} {
  const wallets = loadWallets();

  for (const [chain, why] of wallets.unavailable) {
    // Stated loudly rather than logged quietly. A payout worker that looks
    // healthy while being unable to pay anyone is the worst of both.
    console.warn(`[worker] ${chain} payouts are NOT available: ${why}`);
  }
  if (wallets.senders.size === 0) {
    console.warn(
      "[worker] no chain is configured, so nothing will be sent. Holds still mature and the queue still runs.",
    );
  }

  const worker = new Worker(
    QUEUE.payouts,
    async (job: Job) => {
      switch (job.name) {
        case "release-holds": {
          // Does not need a wallet — it only moves HELD to APPROVED.
          const released = await releaseMaturedHolds();
          return { released };
        }

        case "send-approved":
          return sendApproved(wallets);

        case "confirm-sending":
          return confirmSending(wallets);

        case "reconcile":
          return runReconcile(wallets);

        case "check-float":
          return runFloatCheck(wallets);

        default:
          throw new Error(`Unknown payout job: ${job.name}`);
      }
    },
    // One at a time. Two workers signing from the same hot wallet is a nonce
    // collision on Base and a duplicate-send risk everywhere.
    { connection, concurrency: 1 },
  );

  worker.on("failed", (job, error) => {
    Sentry.captureException(error, { tags: { queue: QUEUE.payouts, job: job?.name } });
    const exhausted = !job || job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!exhausted) return;

    void alert({
      severity: "critical",
      title: `Payout job "${job?.name ?? "unknown"}" failed after ${job?.attemptsMade ?? 0} attempts`,
      detail: error.message,
      context: { queue: QUEUE.payouts, id: job?.id ?? "unknown" },
    });
  });

  worker.on("error", (error) => {
    console.error("[worker] payout queue error:", error);
    Sentry.captureException(error, { tags: { queue: QUEUE.payouts, scope: "connection" } });
  });

  return { worker, wallets };
}

async function sendApproved(wallets: WalletSet) {
  const due = await prisma.withdrawal.findMany({
    where: { status: "APPROVED", chain: { in: [...wallets.senders.keys()] } },
    orderBy: { requestedAt: "asc" }, // oldest first; nobody waits twice
    take: BATCH,
    select: { id: true, chain: true },
  });

  const counts = { sent: 0, skipped: 0, review: 0 };

  for (const row of due) {
    const sender = wallets.senders.get(row.chain);
    if (!sender) continue;

    const outcome = await executeWithdrawal(row.id, sender);
    if (outcome.kind === "sent") counts.sent += 1;
    else if (outcome.kind === "needs-review") counts.review += 1;
    else counts.skipped += 1;
  }

  return counts;
}

async function confirmSending(wallets: WalletSet) {
  const inFlight = await prisma.withdrawal.findMany({
    where: {
      status: "SENDING",
      txHash: { not: null },
      chain: { in: [...wallets.senders.keys()] },
    },
    take: 100,
    select: { id: true, chain: true },
  });

  const counts = { settled: 0, failed: 0, pending: 0 };

  for (const row of inFlight) {
    const sender = wallets.senders.get(row.chain);
    if (!sender) continue;

    const state = await settleWithdrawal(row.id, sender);
    if (state === "settled") counts.settled += 1;
    else if (state === "failed") counts.failed += 1;
    else if (state === "pending") counts.pending += 1;
  }

  return counts;
}

async function runReconcile(wallets: WalletSet) {
  const reports: Record<string, unknown> = {};
  for (const [chain, source] of wallets.histories) {
    reports[chain] = await reconcile(source);
  }
  return reports;
}

async function runFloatCheck(wallets: WalletSet) {
  const figures: Record<string, unknown> = {};
  for (const [chain, sender] of wallets.senders) {
    figures[chain] = await checkFloat(sender);
  }
  return figures;
}

/** Registers the repeating jobs. Idempotent — upsert, not add. */
export async function schedulePayoutJobs(): Promise<void> {
  const queue = getQueue(QUEUE.payouts);

  await queue.upsertJobScheduler("release-holds", { every: 5 * 60_000 }, { name: "release-holds" });
  await queue.upsertJobScheduler("send-approved", { every: 60_000 }, { name: "send-approved" });
  await queue.upsertJobScheduler("confirm-sending", { every: 30_000 }, { name: "confirm-sending" });

  // Reconciliation is expensive (it reads blocks), so it runs on a slow clock.
  // Its job is to catch a rare window, not to be timely.
  await queue.upsertJobScheduler("reconcile", { every: 30 * 60_000 }, { name: "reconcile" });

  // §6.3: a daily alarm on the float.
  await queue.upsertJobScheduler("check-float", { every: 24 * 3600_000 }, { name: "check-float" });
}
