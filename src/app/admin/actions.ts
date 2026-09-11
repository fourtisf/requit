"use server";

import { revalidatePath } from "next/cache";
import type { RiskTier } from "@prisma/client";
import { requireAdmin } from "@/lib/admin/access";
import {
  approveWithdrawal,
  reinstateMember,
  rejectWithdrawal,
  setRiskTier,
  suspendMember,
  type OperationResult,
} from "@/lib/admin/operations";
import { TIER_RULES } from "@/lib/risk";
import type { FormState } from "@/app/admin/form-state";
import type { DisputeOutcome, DisputeStatus } from "@prisma/client";
import { advanceDispute } from "@/lib/disputes";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";

/**
 * Every action re-checks admin.
 *
 * A server action is a POST endpoint with a generated URL, reachable by anyone
 * who has seen it once. That the page rendering the form was gated proves
 * nothing about who is calling the action.
 */
async function run(
  operation: (actorEmail: string) => Promise<OperationResult>,
  paths: readonly string[],
  success: string,
): Promise<FormState> {
  const admin = await requireAdmin();
  const result = await operation(admin.email);
  if (!result.ok) return { error: result.error, done: null };
  for (const path of paths) revalidatePath(path);
  return { error: null, done: success };
}

function reasonOf(form: FormData): string {
  const value = form.get("reason");
  return typeof value === "string" ? value : "";
}

function idOf(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

export async function suspendAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = idOf(form, "userId");
  return run(
    (actorEmail) => suspendMember({ actorEmail, userId, reason: reasonOf(form) }),
    ["/admin/members", `/admin/members/${userId}`],
    "Suspended. The member sees the reason on their next page load.",
  );
}

export async function reinstateAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = idOf(form, "userId");
  return run(
    (actorEmail) => reinstateMember({ actorEmail, userId, reason: reasonOf(form) }),
    ["/admin/members", `/admin/members/${userId}`],
    "Reinstated.",
  );
}

export async function setTierAction(_prev: FormState, form: FormData): Promise<FormState> {
  const userId = idOf(form, "userId");
  const tier = idOf(form, "tier");
  if (!(tier in TIER_RULES)) return { error: "Pick a tier.", done: null };

  return run(
    (actorEmail) =>
      setRiskTier({ actorEmail, userId, tier: tier as RiskTier, reason: reasonOf(form) }),
    ["/admin/members", `/admin/members/${userId}`],
    `Moved to ${TIER_RULES[tier as RiskTier].label}.`,
  );
}

export async function approveWithdrawalAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const withdrawalId = idOf(form, "withdrawalId");
  return run(
    (actorEmail) => approveWithdrawal({ actorEmail, withdrawalId, reason: reasonOf(form) }),
    ["/admin", "/admin/withdrawals"],
    "Approved. The payout worker sends it; nothing has been broadcast yet.",
  );
}

export async function rejectWithdrawalAction(_prev: FormState, form: FormData): Promise<FormState> {
  const withdrawalId = idOf(form, "withdrawalId");
  return run(
    (actorEmail) => rejectWithdrawal({ actorEmail, withdrawalId, reason: reasonOf(form) }),
    ["/admin", "/admin/withdrawals"],
    "Rejected. The amount is back in the member's balance and they are told why.",
  );
}

const TRANSITION_ERRORS: Record<string, string> = {
  unknown: "No such dispute.",
  "already-resolved": "That one is already closed.",
  backwards: "A dispute cannot move back a step — its timestamps are published.",
  "needs-outcome": "Closing a dispute needs an outcome. That is the whole point of closing it.",
};

/**
 * Moves a dispute forward, and tells the member.
 *
 * The notification is not optional politeness: the product's promise is "a
 * status you can watch move", and a status that moves silently is a support
 * black hole with extra steps.
 */
export async function advanceDisputeAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const disputeId = idOf(form, "disputeId");
  const to = idOf(form, "to") as DisputeStatus;
  const outcomeRaw = idOf(form, "outcome");
  const note = reasonOf(form);

  if (note.trim().length < 8) {
    return { error: "Write a note — the member is shown it.", done: null };
  }

  const result = await advanceDispute({
    disputeId,
    to,
    note,
    ...(outcomeRaw ? { outcome: outcomeRaw as DisputeOutcome } : {}),
  });

  if (!result.ok) {
    return { error: TRANSITION_ERRORS[result.reason] ?? "Could not move that.", done: null };
  }

  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    select: { userId: true, status: true },
  });

  if (dispute) {
    // Recorded alongside the member's own history, so the operator view shows
    // who moved a dispute and when, the same as every other manual change.
    await prisma.adminAction.create({
      data: {
        actorEmail: admin.email.toLowerCase(),
        action: `dispute-${to.toLowerCase()}`,
        subjectId: disputeId,
        reason: note.trim(),
      },
    });

    void notify({
      userId: dispute.userId,
      kind: "dispute",
      subject: "Your dispute moved",
      body: note.trim(),
    }).catch(() => undefined);
  }

  revalidatePath("/admin/disputes");
  revalidatePath("/disputes");
  return { error: null, done: "Moved. The member has been told." };
}
