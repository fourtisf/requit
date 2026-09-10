import type { Session } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";

/**
 * Builds the user half of the session, explicitly.
 *
 * Two rules this exists to enforce:
 *
 * 1. **Allowlist, never spread.** The adapter's object carries `sessionToken`
 *    — the credential itself — and /api/auth/session is readable by the
 *    browser. Spreading it would publish that, and would publish any column
 *    added to User later without anyone noticing.
 *
 * 2. **JSON primitives only.** The payload is serialised, so a Date arrives at
 *    the reader as a string while TypeScript still calls it a Date. Derive a
 *    boolean or a preformatted string here; pages that need the real value
 *    read the row.
 */
export function toSessionUser(user: AdapterUser): Session["user"] {
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    countryCode: user.countryCode,
    riskTier: user.riskTier,
    suspended: user.suspendedAt !== null,
  };
}
