import { z } from "zod";
import { auth } from "@/auth";
import { rateLimitAll } from "@/lib/rate-limit";
import { beginBinding } from "@/lib/wallet/bind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  chain: z.enum(["SOLANA", "BASE"]),
  address: z.string().min(1).max(120),
});

const MESSAGES: Record<string, string> = {
  "malformed-address": "That does not look like an address on this chain.",
  "address-taken": "That wallet is already bound to another account.",
  "too-many-wallets": "You already have the maximum number of wallets on this chain.",
};

/** §5 step 1. Returns the nonce and the exact text to sign. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return json({ error: "Sign in first." }, 401);
  if (session.user.suspended) return json({ error: "Account suspended." }, 403);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Give a chain and an address." }, 400);

  // Binding is cheap for us and noisy for an attacker enumerating which
  // addresses are already taken — the refusal above is an oracle, so the rate
  // limit is what keeps it from being a usable one.
  const limit = await rateLimitAll([
    { key: `wallet:nonce:${session.user.id}`, limit: 10, windowSeconds: 10 * 60 },
  ]);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again shortly." }, 429);

  const result = await beginBinding({
    userId: session.user.id,
    chain: parsed.data.chain,
    address: parsed.data.address,
  });

  if (!result.ok) {
    return json({ error: MESSAGES[result.reason] ?? "Could not start." }, 400);
  }

  return json({ nonce: result.nonce, message: result.message, address: result.address }, 200);
}

function json(payload: unknown, status: number): Response {
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}
