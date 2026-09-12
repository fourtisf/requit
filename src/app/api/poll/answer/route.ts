import { auth } from "@/auth";
import { rateLimitAll } from "@/lib/rate-limit";
import { recordAnswer, tallyFor, todaysQuestion } from "@/lib/poll/board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answers today's question and hands back the result.
 *
 * The body carries the chosen option and nothing else. Which question it
 * belongs to and which day it counts for are decided here — the same rule as
 * the daily board's seed. A request that could name its own question could
 * answer one whose results it had already seen, and the point of hiding the
 * results until you answer is that the answer came first.
 *
 * The tally is returned in the same response rather than fetched afterwards:
 * the reveal is the whole reward, and a second round trip is a spinner in the
 * middle of it.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return json({ error: "Sign in first." }, 401);
  if (session.user.suspended) return json({ error: "Account suspended." }, 403);

  const limit = await rateLimitAll([
    { key: `poll:${session.user.id}`, limit: 30, windowSeconds: 60 * 60 },
  ]);
  if (!limit.allowed) return json({ error: "Too many requests." }, 429);

  const body = await request
    .json()
    .then((value: unknown) =>
      value !== null && typeof value === "object" ? (value as { optionId?: unknown }) : {},
    )
    .catch(() => ({}) as { optionId?: unknown });

  if (typeof body.optionId !== "string") {
    return json({ error: "Pick one of the answers." }, 400);
  }

  const result = await recordAnswer(session.user.id, body.optionId);
  if (result.status === "unknown-option") {
    // Also what a tab left open past midnight sends: yesterday's options
    // against today's question. Reloading is the fix, and says so.
    return json({ error: "That is not one of today's answers. Reload the page." }, 400);
  }

  const { day, question } = todaysQuestion();
  return json(
    {
      answered: result.answer.optionId,
      already: result.status === "already",
      tally: await tallyFor(day, question),
    },
    200,
  );
}

function json(payload: unknown, status: number): Response {
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}
