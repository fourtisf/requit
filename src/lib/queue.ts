import { Queue, type JobsOptions } from "bullmq";
import { redis } from "@/lib/redis";

/**
 * HANDOFF.md §2: three subsystems, three failure domains. One queue per domain
 * so that a stuck payout worker cannot stop postbacks from being credited.
 *
 * `offers` and `payouts` are declared here but have no processors until Phases
 * 1 and 2 respectively.
 */
export const QUEUE = {
  offers: "offers",
  payouts: "payouts",
  maintenance: "maintenance",
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 5_000 },
  removeOnFail: { age: 60 * 60 * 24 * 14 },
};

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, { connection: redis(), defaultJobOptions });
  queues.set(name, queue);
  return queue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}
