import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import type { SessionUser } from "@/lib/session";
import { isAdminEmail } from "@/lib/admin/allowlist";

export { adminEmails, isAdminEmail } from "@/lib/admin/allowlist";

export type AdminActor = { user: SessionUser; email: string };

/**
 * The gate for every admin page AND every admin action.
 *
 * Server actions are separately reachable endpoints — rendering a page behind a
 * check proves nothing about who is calling the action it submits to. Every
 * mutation calls this again rather than trusting its caller.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  // 404 rather than 403: a signed-in non-admin learns nothing about whether
  // the route exists at all.
  const email = session.user.email;
  if (!isAdminEmail(email)) notFound();

  // isAdminEmail refuses null and undefined, but the session type does not know
  // that. Narrowed here so every audit row has a real actor.
  return { user: session.user, email: email as string };
}

/** Non-redirecting variant, for deciding whether to show the nav entry. */
export async function viewerIsAdmin(): Promise<boolean> {
  const session = await auth();
  return isAdminEmail(session?.user?.email);
}
