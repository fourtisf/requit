import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";
import { startSession } from "@/lib/games/session";
import { isGameSlug } from "@/lib/games/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens a round of one game and hands back its seed.
 *
 * Rate limited because every call writes a row, and a loop here would fill the
 * table for free. The limit is well above anyone actually playing: a round
 * takes minutes, not milliseconds.
 *
 * The game is named here and stored on the row, so the slug that scores the
 * round later is one the server wrote down — not one that arrives with the
 * moves, where a losing round of Trail could be submitted as a winning one of
 * Merge.
 */
export async function POST(request: Request) {
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

  // A body is expected, but an absent or unreadable one is read as merge
  // rather than refused: a tab left open across the deploy that added the other
  // three games is still sending the old bodiless request, and its round is
  // perfectly scoreable.
  const body = await request
    .json()
    .then((value: unknown) =>
      value !== null && typeof value === "object" ? (value as { game?: unknown }) : {},
    )
    .catch(() => ({}) as { game?: unknown });
  const game = body.game ?? "merge";
  if (!isGameSlug(game)) {
    return NextResponse.json({ error: "No such game." }, { status: 404 });
  }

  const round = await startSession(session.user.id, game);
  return NextResponse.json(round);
}
