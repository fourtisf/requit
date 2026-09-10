/**
 * The single source of truth for the brand.
 *
 * HANDOFF.md §0.1: the name is a PLACEHOLDER until ALFA confirms it. Changing it
 * must be one edit to this file — so do not hardcode the name anywhere else. Not
 * in copy, not in email templates, not in meta tags.
 */
export const BRAND = {
  name: "Requit",
  domain: "requit.com",
  ticker: "RQT",
  supportEmail: "support@requit.com",
} as const;

export type Brand = typeof BRAND;
