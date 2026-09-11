import { Prisma, type Dispute, type DisputeOutcome, type DisputeStatus, type Network } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Disputes. §6, and the promise the marketing site already makes: "a status you
 * can watch move" rather than a support black hole.
 *
 * The statuses are not decoration. Each one stamps a timestamp, and those
 * timestamps are what /api/public/sla publishes — so the published response
 * times are the real ones by construction, and cannot drift from what actually
 * happened.
 */

export const MAX_EVIDENCE = 5;
export const MAX_OPEN_DISPUTES = 10;

/** What a member is told each status means. One wording, used everywhere. */
export const STATUS_MEANING: Record<DisputeStatus, string> = {
  SUBMITTED: "We have it. Nobody has looked yet.",
  ACKNOWLEDGED: "A person has read it and is working on it.",
  ESCALATED: "We have taken it to the network on your behalf.",
  AWAITING_NETWORK: "With the network. We are waiting on them, and we chase.",
  RESOLVED: "Closed. The outcome is below.",
};

export const OUTCOME_MEANING: Record<DisputeOutcome, string> = {
  PAID: "We paid it.",
  REJECTED_BY_ADVERTISER:
    "The advertiser refused it. We are telling you that rather than letting it go quiet.",
  EXPIRED: "The network never answered within their own window, so we closed it.",
  WITHDRAWN: "You withdrew this one.",
};

/** Outcomes that count as the member getting their money, for the §8 paid rate. */
export const PAID_OUTCOMES: readonly DisputeOutcome[] = ["PAID"];

export type SubmitFailure =
  | "no-reason"
  | "too-many-open"
  | "bad-amount"
  | "too-much-evidence"
  | "bad-evidence-url"
  | "suspended";

export type SubmitResult = { ok: true; dispute: Dispute } | { ok: false; reason: SubmitFailure };

/**
 * Evidence is a list of links, not uploads.
 *
 * §11 step 9 says "evidence upload", and this deliberately does less: accepting
 * arbitrary files from unauthenticated-adjacent users means storage, malware
 * scanning, and a content-moderation surface, all to hold screenshots that
 * already live somewhere the member can link to. If that trade ever stops
 * making sense it is one field change plus a storage bucket — the schema column
 * is already a string array either way.
 */
function evidenceProblem(urls: string[]): SubmitFailure | null {
  if (urls.length > MAX_EVIDENCE) return "too-much-evidence";

  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return "bad-evidence-url";
    }
    // http(s) only: a javascript: or data: link would be rendered in the admin
    // panel, where an operator clicking it is the whole attack.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "bad-evidence-url";
    if (raw.length > 500) return "bad-evidence-url";
  }

  return null;
}

export async function submitDispute(input: {
  userId: string;
  network: Network;
  claimedAmount: Prisma.Decimal;
  reason: string;
  evidenceUrls: string[];
  offerId?: string;
}): Promise<SubmitResult> {
  const reason = input.reason.trim();
  if (reason.length < 20) return { ok: false, reason: "no-reason" };

  if (input.claimedAmount.lessThanOrEqualTo(0) || input.claimedAmount.greaterThan(10_000)) {
    return { ok: false, reason: "bad-amount" };
  }

  const evidence = evidenceProblem(input.evidenceUrls);
  if (evidence) return { ok: false, reason: evidence };

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { suspendedAt: true },
  });
  if (!user) return { ok: false, reason: "suspended" };
  // A suspended member can still appeal by email (see /suspended); what they
  // cannot do is open new disputes, which is otherwise a free way to keep a
  // banned account generating work.
  if (user.suspendedAt) return { ok: false, reason: "suspended" };

  const open = await prisma.dispute.count({
    where: { userId: input.userId, status: { not: "RESOLVED" } },
  });
  if (open >= MAX_OPEN_DISPUTES) return { ok: false, reason: "too-many-open" };

  const dispute = await prisma.dispute.create({
    data: {
      userId: input.userId,
      network: input.network,
      claimedAmount: input.claimedAmount,
      statusNote: reason,
      evidenceUrls: input.evidenceUrls,
      ...(input.offerId ? { offerId: input.offerId } : {}),
    },
  });

  return { ok: true, dispute };
}

export type TransitionFailure = "unknown" | "already-resolved" | "backwards" | "needs-outcome";

/** The order a dispute may move through. Backwards is refused. */
const ORDER: DisputeStatus[] = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ESCALATED",
  "AWAITING_NETWORK",
  "RESOLVED",
];

export async function advanceDispute(input: {
  disputeId: string;
  to: DisputeStatus;
  note: string;
  outcome?: DisputeOutcome;
}): Promise<{ ok: true } | { ok: false; reason: TransitionFailure }> {
  const dispute = await prisma.dispute.findUnique({ where: { id: input.disputeId } });
  if (!dispute) return { ok: false, reason: "unknown" };
  if (dispute.status === "RESOLVED") return { ok: false, reason: "already-resolved" };

  const from = ORDER.indexOf(dispute.status);
  const to = ORDER.indexOf(input.to);
  // A status that can go backwards is a status nobody can trust, and these
  // timestamps are published.
  if (to <= from) return { ok: false, reason: "backwards" };

  // §8 publishes a paid rate. A resolution with no outcome would be a dispute
  // that closed without an answer, which is the thing this whole flow exists to
  // prevent.
  if (input.to === "RESOLVED" && !input.outcome) return { ok: false, reason: "needs-outcome" };

  const now = new Date();
  await prisma.dispute.update({
    where: { id: input.disputeId },
    data: {
      status: input.to,
      statusNote: input.note.trim() || dispute.statusNote,
      // firstReplyAt is stamped once, on the first move away from SUBMITTED —
      // it is time-to-first-human, and re-stamping it later would flatter the
      // published figure.
      ...(dispute.firstReplyAt === null ? { firstReplyAt: now } : {}),
      ...(input.to === "ESCALATED" && dispute.escalatedAt === null ? { escalatedAt: now } : {}),
      ...(input.to === "RESOLVED" && input.outcome
        ? { resolvedAt: now, outcome: input.outcome }
        : {}),
    },
  });

  return { ok: true };
}
