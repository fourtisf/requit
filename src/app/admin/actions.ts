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
