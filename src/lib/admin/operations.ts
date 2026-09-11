import type { Prisma, RiskTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TIER_RULES } from "@/lib/risk";
import { balanceOf } from "@/lib/balance";

export type OperationResult = { ok: true } | { ok: false; error: string };

const MIN_REASON = 8;

/**
 * A reason is mandatory on every operator write, and it is not decoration.
 *
 * §7: "never ban silently" — /suspended shows the member what they were told.
 * A blank or one-word reason produces exactly the unexplained-ban complaint the
 * product positions against, so it is refused here rather than left to the UI.
 */
function checkReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON) {
    return `Give a reason of at least ${MIN_REASON} characters — the member is shown it.`;
  }
  return null;
}

/**
 * Records what an operator did, in the same transaction as the change itself.
 *
 * Writing the audit row afterwards would let the change succeed and the record
 * fail, which is the one combination that makes a dispute unanswerable.
 */
async function record(
  tx: Prisma.TransactionClient,
  entry: {
    actorEmail: string;
    action: string;
    subjectId: string;
    reason: string;
    detail?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.adminAction.create({
    data: {
      actorEmail: entry.actorEmail.toLowerCase(),
      action: entry.action,
      subjectId: entry.subjectId,
      reason: entry.reason.trim(),
      ...(entry.detail === undefined ? {} : { detail: entry.detail }),
    },
  });
}

export async function suspendMember(input: {
  actorEmail: string;
  userId: string;
  reason: string;
}): Promise<OperationResult> {
  const invalid = checkReason(input.reason);
  if (invalid) return { ok: false, error: invalid };

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, suspendedAt: true },
  });
  if (!user) return { ok: false, error: "No such member." };
  if (user.suspendedAt) return { ok: false, error: "Already suspended." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { suspendedAt: new Date(), suspendReason: input.reason.trim() },
    });
    await record(tx, {
      actorEmail: input.actorEmail,
      action: "suspend",
      subjectId: input.userId,
      reason: input.reason,
    });
  });

  return { ok: true };
}

export async function reinstateMember(input: {
  actorEmail: string;
  userId: string;
  reason: string;
}): Promise<OperationResult> {
  const invalid = checkReason(input.reason);
  if (invalid) return { ok: false, error: invalid };

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, suspendedAt: true, suspendReason: true },
  });
  if (!user) return { ok: false, error: "No such member." };
  const wasSuspendedAt = user.suspendedAt;
  if (!wasSuspendedAt) return { ok: false, error: "Not suspended." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: input.userId },
      data: { suspendedAt: null, suspendReason: null },
    });
    await record(tx, {
      actorEmail: input.actorEmail,
      action: "reinstate",
      subjectId: input.userId,
      reason: input.reason,
      detail: { wasSuspendedAt: wasSuspendedAt.toISOString(), wasReason: user.suspendReason },
    });
  });

  return { ok: true };
}

export async function setRiskTier(input: {
  actorEmail: string;
  userId: string;
  tier: RiskTier;
  reason: string;
}): Promise<OperationResult> {
  const invalid = checkReason(input.reason);
  if (invalid) return { ok: false, error: invalid };
  if (!(input.tier in TIER_RULES)) return { ok: false, error: "Unknown tier." };

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, riskTier: true },
  });
  if (!user) return { ok: false, error: "No such member." };
  if (user.riskTier === input.tier) return { ok: false, error: "Already on that tier." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: input.userId }, data: { riskTier: input.tier } });
    await record(tx, {
      actorEmail: input.actorEmail,
      action: "set-tier",
      subjectId: input.userId,
      reason: input.reason,
      detail: { from: user.riskTier, to: input.tier },
    });
  });

  return { ok: true };
}

/**
 * Releases a held withdrawal for sending.
 *
 * Approval does NOT send. It moves the row to APPROVED and the payout worker
 * picks it up — one place broadcasts transactions, and it is not a request
 * handler. Until that worker ships (Phase 2), an approved row simply waits,
 * which is the safe direction to be incomplete in.
 */
export async function approveWithdrawal(input: {
  actorEmail: string;
  withdrawalId: string;
  reason: string;
}): Promise<OperationResult> {
  const invalid = checkReason(input.reason);
  if (invalid) return { ok: false, error: invalid };

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: { id: true, status: true, userId: true, amount: true },
  });
  if (!withdrawal) return { ok: false, error: "No such withdrawal." };
  if (withdrawal.status !== "REQUESTED" && withdrawal.status !== "HELD") {
    return { ok: false, error: `Cannot approve a ${withdrawal.status.toLowerCase()} withdrawal.` };
  }

  // Re-check solvency at approval time. The balance that justified the request
  // can have moved since — a reversal lands between request and review far more
  // often than it sounds, because that gap is exactly the hold window.
  const balance = await balanceOf(withdrawal.userId);
  if (!balance.shortfall.isZero()) {
    return {
      ok: false,
      error: `This member is ${balance.shortfall.toFixed(2)} short after a reversal. Resolve that first.`,
    };
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Conditioned on the status we read, so two reviewers clicking at once
    // cannot both approve.
    const { count } = await tx.withdrawal.updateMany({
      where: { id: input.withdrawalId, status: withdrawal.status },
      data: { status: "APPROVED" },
    });
    if (count === 0) return false;

    await record(tx, {
      actorEmail: input.actorEmail,
      action: "approve-withdrawal",
      subjectId: input.withdrawalId,
      reason: input.reason,
      detail: { from: withdrawal.status, to: "APPROVED", amount: withdrawal.amount.toFixed(4) },
    });
    return true;
  });

  if (!updated) return { ok: false, error: "Someone else already reviewed this one." };
  return { ok: true };
}

export async function rejectWithdrawal(input: {
  actorEmail: string;
  withdrawalId: string;
  reason: string;
}): Promise<OperationResult> {
  const invalid = checkReason(input.reason);
  if (invalid) return { ok: false, error: invalid };

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: input.withdrawalId },
    select: { id: true, status: true },
  });
  if (!withdrawal) return { ok: false, error: "No such withdrawal." };
  if (withdrawal.status === "SETTLED" || withdrawal.status === "SENDING") {
    return { ok: false, error: "Already on chain. It cannot be rejected." };
  }
  if (withdrawal.status === "FAILED") return { ok: false, error: "Already failed." };

  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.withdrawal.updateMany({
      where: { id: input.withdrawalId, status: withdrawal.status },
      // FAILED returns the amount to the balance: balanceOf() counts every
      // non-FAILED withdrawal as committed, so this is what un-commits it.
      data: { status: "FAILED", failureReason: input.reason.trim() },
    });
    if (count === 0) return false;

    await record(tx, {
      actorEmail: input.actorEmail,
      action: "reject-withdrawal",
      subjectId: input.withdrawalId,
      reason: input.reason,
      detail: { from: withdrawal.status, to: "FAILED" },
    });
    return true;
  });

  if (!updated) return { ok: false, error: "Someone else already reviewed this one." };
  return { ok: true };
}
