/**
 * Who may open the admin panel.
 *
 * This is an environment allowlist, not a column on User, and that is
 * deliberate. An `isAdmin` boolean in the database means any write path that
 * can be tricked into updating a User row — a postback handler, a settings
 * form, a future import script — is a privilege escalation. An allowlist in the
 * process environment can only be changed by someone who can already deploy.
 *
 * HANDOFF.md §3 has no admin column, and this keeps it that way.
 *
 * Kept free of any next-auth import so the predicate stays unit-testable on its
 * own: it is the single decision the whole panel rests on.
 */
export function adminEmails(): readonly string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowlist = adminEmails();
  // An empty allowlist means nobody, never everybody. The panel can suspend
  // accounts and release money; "unconfigured" has to fail closed.
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.toLowerCase());
}
