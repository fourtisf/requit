import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { rateLimitAll } from "@/lib/rate-limit";
import { MAX_EVIDENCE, MAX_OPEN_DISPUTES, submitDispute } from "@/lib/disputes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  network: z.enum(["CPX", "LOOTABLY", "TIMEWALL", "TOROX"]),
  claimedAmount: z.string().regex(/^\d{1,6}(\.\d{1,2})?$/, "Give the amount as a plain number."),
  reason: z.string().min(20).max(4000),
  evidenceUrls: z.array(z.string().max(500)).max(MAX_EVIDENCE).default([]),
});

const MESSAGES: Record<string, string> = {
  "no-reason": "Tell us what happened — at least a sentence.",
  "too-many-open": `You already have ${MAX_OPEN_DISPUTES} disputes open.`,
  "bad-amount": "Give the amount you expected to be paid.",
  "too-much-evidence": `Up to ${MAX_EVIDENCE} links.`,
  "bad-evidence-url": "Evidence must be plain http or https links.",
  suspended: "Your account is suspended. Reply to the suspension email instead.",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return json({ error: "Sign in first." }, 401);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Bad request." }, 400);
  }

  const limit = await rateLimitAll([
    { key: `dispute:${session.user.id}`, limit: 10, windowSeconds: 60 * 60 },
  ]);
  if (!limit.allowed) return json({ error: "Too many. Try again shortly." }, 429);

  const result = await submitDispute({
    userId: session.user.id,
    network: parsed.data.network,
    claimedAmount: new Prisma.Decimal(parsed.data.claimedAmount),
    reason: parsed.data.reason,
    evidenceUrls: parsed.data.evidenceUrls.filter((url) => url.trim() !== ""),
  });

  if (!result.ok) return json({ error: MESSAGES[result.reason] ?? "Could not open that." }, 400);

  return json({ dispute: { id: result.dispute.id, status: result.dispute.status } }, 201);
}

function json(payload: unknown, status: number): Response {
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}
