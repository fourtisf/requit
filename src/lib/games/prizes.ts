import { currentWeek } from "@/lib/leaderboard";
import type { LeaderboardWindow } from "@/lib/leaderboard";

/**
 * Whether a week's game rankings can be turned into anything, and why not.
 *
 * The boards are live and pay nothing. This file is the structure that keeps it
 * that way on purpose rather than by accident: a weekly window that is already
 * the one a distribution would use, and two gates that both answer no.
 *
 * It is deliberately the same shape as src/lib/ads/rewarded.ts. A gate that is
 * named, listed and refusing is a gate somebody has to consciously open; a
 * feature that is simply missing is one a future Friday adds without noticing
 * what it committed the company to.
 *
 * The two gates, and what each would actually take:
 *
 * 1. MONEY. A ranking prize has to be paid by somebody. Our own games earn
 *    through rewarded video and no ad network is connected (see rewarded.ts),
 *    so today the only available source is the company's own float — which is
 *    paying members out of capital, the arrangement this product exists to not
 *    be. Revenue first, prizes second, never the other way round.
 *
 * 2. LAW. Paying a leaderboard from a pot, on a schedule, by rank, is a
 *    different thing in different countries — in several it is a lottery or a
 *    game of chance with the licensing that implies, and HANDOFF.md §9 already
 *    puts the token half behind a written legal go-ahead. Nothing here ships
 *    before docs/LEGAL-REVIEW.md says it can.
 *
 * Until both open, no screen mentions a prize. A leaderboard that hints at
 * money that is not there would be the first broken promise a visitor met, and
 * this site's whole argument is that it does not make those.
 */

export type PrizeGate = {
  /** Flip only when an ad network is paying us for these rounds. */
  funded: boolean;
  /** Flip only on a written legal go-ahead, per HANDOFF.md §9. */
  cleared: boolean;
};

export const PRIZE_GATE: PrizeGate = { funded: false, cleared: false };

export type PrizeStatus =
  | { paying: true }
  | { paying: false; reason: "no-revenue" | "legally-gated" };

export function prizeStatus(gate: PrizeGate = PRIZE_GATE): PrizeStatus {
  if (!gate.funded) return { paying: false, reason: "no-revenue" };
  if (!gate.cleared) return { paying: false, reason: "legally-gated" };
  return { paying: true };
}

/**
 * The window a weekly board is ranked over.
 *
 * It is `currentWeek()` — the same Sunday-to-Sunday UTC window §9 accrues
 * against — rather than a second definition of a week. If a distribution is
 * ever wired to these rankings, the board on screen and the thing that pays
 * cannot disagree about which rounds were in the week, because there is only
 * one answer to ask.
 */
export function prizeWeek(now = new Date()): LeaderboardWindow {
  return currentWeek(now);
}
