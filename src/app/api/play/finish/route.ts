import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { finishSession, type FinishFailure } from "@/lib/games/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scores a round.
 *
 * The body carries the session id and the moves — never a score. Whatever the
 * browser thinks it scored is not in the request at all, so there is nothing
 * for a tampered client to inflate.
 */
const STATUS: Record<FinishFailure, number> = {
  "not-found": 404,
  "already-finished": 409,
  "bad-moves": 400,
  "too-many-moves": 400,
  "illegal-move": 422,
};

const MESSAGE: Record<FinishFailure, string> = {
  "not-found": "That round does not exist.",
  "already-finished": "That round was already scored.",
  "bad-moves": "That is not a list of moves.",
  "too-many-moves": "That round is too long to check.",
  "illegal-move": "Those moves do not match the board they claim to be from.",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }

  const payload = body as { sessionId?: unknown; moves?: unknown };
  if (typeof payload.sessionId !== "string") {
    return NextResponse.json({ error: "Which round?" }, { status: 400 });
  }

  const result = await finishSession({
    userId: session.user.id,
    sessionId: payload.sessionId,
    moves: payload.moves,
  });

  if (!result.ok) {
    return NextResponse.json({ error: MESSAGE[result.reason] }, { status: STATUS[result.reason] });
  }

  return NextResponse.json(result);
}
