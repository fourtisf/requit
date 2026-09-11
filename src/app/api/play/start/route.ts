import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/games/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens a round and hands back its seed.
 *
 * Rate limited because every call writes a row, and a loop here would fill the
 * table for free. The limit is well above anyone actually playing: a round
 * takes minutes, not milliseconds.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  if (session.user.suspended) {
    return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  }

  const limit = await rateLimit(`play:start:${session.user.id}`, 60, 60 * 10);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many rounds started. Wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const round = await startSession(session.user.id);
  return NextResponse.json(round);
}
