import { BRAND } from "@/lib/brand";

/**
 * Operator identity and policy dates.
 *
 * HANDOFF.md §14 puts the registered entity, its jurisdiction and its company
 * number with ALFA — they are facts about a company, not something a developer
 * gets to decide. Anything not yet known is `null`, and the pages say so in
 * plain words rather than printing a plausible-looking placeholder.
 *
 * Offer networks read these pages during publisher review (§4.3). A policy that
 * names no operator will not pass that review, so filling these in is on the
 * critical path to Phase 1 — not a tidy-up.
 */
export const LEGAL = {
  /** e.g. "Fourtis Labs, Inc." — null until ALFA confirms. */
  entityName: null as string | null,
  /** e.g. "Delaware, United States" */
  jurisdiction: null as string | null,
  /** Company or registration number. */
  companyNumber: null as string | null,
  /** Registered postal address. */
  address: null as string | null,

  contactEmail: BRAND.supportEmail,
  privacyEmail: BRAND.supportEmail,

  /**
   * The date each policy last changed. Bump it in the same commit as the
   * change — a policy whose date never moves reads as one nobody maintains.
   */
  effective: {
    terms: "2026-09-11",
    privacy: "2026-09-11",
    rewards: "2026-09-11",
  },
} as const;

/** True once ALFA has supplied the company facts the policies refer to. */
export function operatorIdentified(): boolean {
  return LEGAL.entityName !== null && LEGAL.jurisdiction !== null;
}

/** How the operator is named in prose when the entity is not yet confirmed. */
export function operatorName(): string {
  return LEGAL.entityName ?? `the operator of ${BRAND.name}`;
}
