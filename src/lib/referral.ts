import { randomInt } from "node:crypto";

/**
 * Referral codes are meant to be said out loud and typed back.
 *
 * The country checker targets Indonesia, Brazil, Mexico, the Philippines,
 * Vietnam, Nigeria and India — mostly non-English speakers, and word of mouth is
 * the channel referral exists to serve. So the alphabet is Crockford base32,
 * which drops the four characters people mistype when transcribing: I, L, O, U.
 */
export const REFERRAL_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const REFERRAL_CODE_LENGTH = 8;

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    code += REFERRAL_ALPHABET[randomInt(0, REFERRAL_ALPHABET.length)];
  }
  return code;
}

/**
 * Accepts what a human actually types: lowercase, spaces, dashes, and the four
 * characters Crockford maps back (I and L to 1, O to 0). Rejecting a code
 * because someone typed a lowercase L is a self-inflicted support ticket.
 */
export function normaliseReferralCode(raw: string): string | null {
  const cleaned = raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");

  if (cleaned.length !== REFERRAL_CODE_LENGTH) return null;
  if (![...cleaned].every((char) => REFERRAL_ALPHABET.includes(char))) return null;

  return cleaned;
}

export type ReferrerCandidate = {
  id: string;
  suspendedAt: Date | null;
  signupIpHash: string | null;
};

export type NewUserContext = {
  signupIpHash: string | null;
};

export type AttributionDecision =
  | { attributed: true; referrerId: string }
  | { attributed: false; reason: AttributionRefusal };

export type AttributionRefusal = "unknown-code" | "referrer-suspended" | "same-source";

/**
 * Decides whether a signup counts as referred.
 *
 * HANDOFF.md §7 is blunt that this category attracts organised abuse, and a
 * referral programme is the classic multi-account vector: the cheapest attack is
 * to refer yourself repeatedly. So these rules ship WITH the feature, not after
 * it.
 *
 * Refusing attribution is not the same as refusing the signup. The account is
 * created either way; it simply is not credited to anyone. Blocking signups on
 * a heuristic this weak would lock out flatmates and office networks.
 *
 * What this cannot catch yet: a referrer on a different IP. Device
 * fingerprinting and IP reputation are §7 and land in Phase 1; when they do,
 * add the fingerprint check here.
 */
export function decideAttribution(
  referrer: ReferrerCandidate | null,
  newUser: NewUserContext,
): AttributionDecision {
  if (!referrer) return { attributed: false, reason: "unknown-code" };

  // A suspended account must not keep earning from referrals.
  if (referrer.suspendedAt) return { attributed: false, reason: "referrer-suspended" };

  // Same source as the referrer's own signup — the self-referral case.
  if (
    referrer.signupIpHash !== null &&
    newUser.signupIpHash !== null &&
    referrer.signupIpHash === newUser.signupIpHash
  ) {
    return { attributed: false, reason: "same-source" };
  }

  return { attributed: true, referrerId: referrer.id };
}

/** The link a member shares. */
export function referralUrl(appUrl: string, code: string): string {
  const url = new URL("/", appUrl);
  url.searchParams.set("ref", code);
  return url.toString();
}
