import { z } from "zod";
import { auth } from "@/auth";
import { rateLimitAll } from "@/lib/rate-limit";
import { completeBinding } from "@/lib/wallet/bind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({
  nonce: z.string().min(1).max(64),
  signature: z.string().min(1).max(512),
});

const MESSAGES: Record<string, string> = {
  "unknown-or-used-nonce": "That request expired or was already used. Start again.",
  "wrong-session": "That request expired or was already used. Start again.",
  "bad-signature": "The signature did not match that address.",
  "address-taken": "That wallet is already bound to another account.",
};

/** §5 steps 2 and 3. Verifies the signature and writes the wallet. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return json({ error: "Sign in first." }, 401);
  if (session.user.suspended) return json({ error: "Account suspended." }, 403);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Give a nonce and a signature." }, 400);

  const limit = await rateLimitAll([
    { key: `wallet:verify:${session.user.id}`, limit: 20, windowSeconds: 10 * 60 },
  ]);
  if (!limit.allowed) return json({ error: "Too many attempts. Try again shortly." }, 429);

  const result = await completeBinding({
    userId: session.user.id,
    nonce: parsed.data.nonce,
    signature: parsed.data.signature,
  });

  if (!result.ok) {
    // "wrong-session" and "unknown-or-used-nonce" share wording on purpose: the
    // difference between them tells an attacker whether a nonce they hold is
    // real, which is the only thing that distinction is useful for.
    return json({ error: MESSAGES[result.reason] ?? "Could not verify." }, 400);
  }

  return json(
    {
      wallet: {
        id: result.wallet.id,
        chain: result.wallet.chain,
        address: result.wallet.address,
        isPayout: result.wallet.isPayout,
      },
    },
    200,
  );
}

function json(payload: unknown, status: number): Response {
  return Response.json(payload, { status, headers: { "cache-control": "no-store" } });
}
