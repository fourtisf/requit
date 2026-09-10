/**
 * Where a referral code waits between the click and the signup.
 *
 * Separate module because middleware (edge runtime) and the adapter (node) both
 * need the name, and middleware must not pull in anything node-only.
 */
export const REFERRAL_COOKIE = "requit.ref";

/** Long enough to survive someone bookmarking the link and signing up later. */
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
