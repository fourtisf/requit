import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";

export type SessionUser = Session["user"];

/**
 * The authoritative gate for a signed-in page.
 *
 * Middleware only checks that a session cookie exists — it runs on the edge and
 * cannot reach the database. Suspension, risk tier and anything else that lives
 * in a row has to be decided here. Every page behind sign-in calls this rather
 * than `auth()` directly, so a new page cannot forget the suspension check.
 *
 * Sessions are database-backed, so the row is re-read on each request: a user
 * suspended mid-session is stopped on their next navigation, not at expiry.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user) redirect("/signin");

  // HANDOFF.md §7: never ban silently. /suspended states the reason and gives a
  // route to appeal — the alternative generates exactly the public complaints
  // this product positions against.
  if (session.user.suspended) redirect("/suspended");

  return session.user;
}

/** For pages that render differently when signed in, but do not require it. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}
