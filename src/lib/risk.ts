import type { RiskTier } from "@prisma/client";

/**
 * The withdrawal hold ladder, exactly as HANDOFF.md §6.1 specifies it.
 *
 * One definition, used by both the payout pipeline (Phase 2) and the progress UI.
 * If these ever disagree, the product is telling users one thing and doing
 * another — which in this product is the whole failure mode.
 */
export type TierRule = {
  tier: RiskTier;
  /** Null means the withdrawal is approved immediately. */
  holdHours: number | null;
  label: string;
  meaning: string;
};

export const TIER_RULES: Record<RiskTier, TierRule> = {
  NEW: {
    tier: "NEW",
    holdHours: 72,
    label: "New",
    meaning: "Withdrawals are held for 72 hours while your first completions settle.",
  },
  STANDARD: {
    tier: "STANDARD",
    holdHours: 24,
    label: "Standard",
    meaning: "Withdrawals are held for 24 hours.",
  },
  TRUSTED: {
    tier: "TRUSTED",
    holdHours: null,
    label: "Trusted",
    meaning: "Withdrawals are approved immediately, with no hold.",
  },
  FLAGGED: {
    tier: "FLAGGED",
    holdHours: null,
    label: "Under review",
    meaning:
      "Withdrawals go to a person before they are sent. You can still complete tasks and you still get paid.",
  },
};

/**
 * The ladder shown to a member, best to worst.
 *
 * FLAGGED is deliberately absent: it is not a rung, it is a side state. Showing
 * it as the bottom of a ladder would tell a flagged user they have been demoted
 * and have to climb back, which is not what §7 means by it.
 */
export const TIER_LADDER: readonly RiskTier[] = ["NEW", "STANDARD", "TRUSTED"] as const;

export function holdDescription(tier: RiskTier): string {
  const hours = TIER_RULES[tier].holdHours;
  if (hours === null) return "no hold";
  return hours >= 24 ? `${hours / 24}-day hold` : `${hours}-hour hold`;
}

export function isLadderTier(tier: RiskTier): boolean {
  return TIER_LADDER.includes(tier);
}
