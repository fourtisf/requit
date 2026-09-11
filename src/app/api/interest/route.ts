import { auth } from "@/auth";
import { rateLimitAll } from "@/lib/rate-limit";
import { registerInterest } from "@/lib/interest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "unknown-country": "Set your country in settings first — that is what we match tasks on.",
  suspended: "Your account is suspended.",
  "already-live": "There are already tasks for your country. Reload the page.",
};

/** "Tell me when there are tasks here." Country comes from the session, not the body. */
export async function POST() {
  const session = await auth();
  if (!session?.user) return json({ error: "Sign in first." }, 401);

  const limit = await rateLimitAll([
    { key: `interest:${session.user.id}`, limit: 20, windowSeconds: 60 * 60 },
  ]);
  if (!limit.allowed) return json({ error: "Too many requests." }, 429);

  // Taken from the session rather than the request: a member can only ask about
  // the country they are actually in, so the demand figures stay a measure of
  // real people rather than of whatever a client felt like posting.
  const result = await registerInterest({
    userId: session.user.id,
    countryCode: session.user.countryCode,
  });

  if (!result.ok) return json({ error: MESSAGES[result.reason] ?? "Could not do that." }, 400);

  return json({ waiting: result.waiting, alreadyWaiting: result.alreadyWaiting }, 200);
}

function json(payload: unknown, status: number): Response {
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}
