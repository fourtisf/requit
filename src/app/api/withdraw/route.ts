import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { rateLimitAll } from "@/lib/rate-limit";
import { MIN_WITHDRAWAL, requestWithdrawal } from "@/lib/withdraw";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  walletId: z.string().min(1).max(64),
  // A string, not a number: JSON numbers are doubles, and routing money through
  // a double is how 10.10 becomes 10.099999999999998.
  amount: z.string().regex(/^\d{1,9}(\.\d{1,4})?$/, "Amount must be a plain decimal."),
  idempotencyKey: z.string().min(8).max(128),
});

const MESSAGES: Record<string, string> = {
  "unknown-wallet": "That wallet is not one of yours.",
  "wallet-not-verified": "Verify that wallet before withdrawing to it.",
  "below-minimum": `The minimum withdrawal is $${MIN_WITHDRAWAL.toFixed(2)}.`,
  "insufficient-balance": "That is more than your available balance.",
  suspended: "Your account is suspended.",
};

/** §6.1. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return json({ error: "Sign in first." }, 401);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Bad request." }, 400);
  }

  const limit = await rateLimitAll([
    { key: `withdraw:${session.user.id}`, limit: 10, windowSeconds: 60 * 60 },
  ]);
  if (!limit.allowed) return json({ error: "Too many requests. Try again shortly." }, 429);

  const result = await requestWithdrawal({
    userId: session.user.id,
    walletId: parsed.data.walletId,
    amount: new Prisma.Decimal(parsed.data.amount),
    idempotencyKey: parsed.data.idempotencyKey,
  });

  if (!result.ok) {
    return json(
      {
        error: MESSAGES[result.reason] ?? "Could not request that.",
        ...(result.available ? { available: result.available.toFixed(2) } : {}),
      },
      400,
    );
  }

  // Only on a first request. A replay is the same event, and telling someone
  // twice that their withdrawal is in makes them think they asked twice.
  if (!result.replayed) {
    void notify({
      userId: session.user.id,
      kind: "withdrawal",
      subject: "Withdrawal requested",
      body: `We have your request for $${result.withdrawal.amount.toFixed(2)}.`,
    }).catch(() => undefined);
  }

  return json(
    {
      withdrawal: {
        id: result.withdrawal.id,
        amount: result.withdrawal.amount.toFixed(2),
        status: result.withdrawal.status,
        chain: result.withdrawal.chain,
        requestedAt: result.withdrawal.requestedAt.toISOString(),
      },
      replayed: result.replayed,
    },
    result.replayed ? 200 : 201,
  );
}

function json(payload: unknown, status: number): Response {
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}
