import type { NextRequest } from "next/server";
import type { Network } from "@prisma/client";
import { clientIp } from "@/lib/request-ip";
import { alert } from "@/lib/alert";
import { Sentry } from "@/lib/observability";
import { checkIp, networkConfig } from "@/lib/networks/config";
import { verifySignature } from "@/lib/networks/spec";
import { applyPostback, parsePostback } from "@/lib/networks/postback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NETWORKS: Record<string, Network> = {
  cpx: "CPX",
  lootably: "LOOTABLY",
  timewall: "TIMEWALL",
  torox: "TOROX",
};

/**
 * Server-to-server postback. HANDOFF.md §4.2, in that order:
 *
 *   1. IP allowlist
 *   2. Signature
 *   3. Idempotency
 *   4. Status (credit or reversal)
 *   5. Credit with the risk-tier hold
 *   6. Answer exactly what the network expects
 *
 * Step 6 is not cosmetic. §13: a network that receives non-200 too often
 * disables the publisher. So once a request is past authentication, every
 * outcome — including our own internal failure — answers 200 with their
 * expected body, and the error goes to Sentry and Telegram instead of into the
 * response.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ network: string }> }) {
  return handle(request, context);
}

// Registered as GET with every network, but accepted as POST too — some send
// both, and a 405 would look like a failure worth retrying forever.
export async function POST(request: NextRequest, context: { params: Promise<{ network: string }> }) {
  return handle(request, context);
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ network: string }> },
): Promise<Response> {
  const { network: slug } = await context.params;
  const network = NETWORKS[slug.toLowerCase()];
  if (!network) return text("unknown network", 404);

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const config = networkConfig(network);

  // ── 1. IP allowlist ───────────────────────────────────────────────────────
  const ip = clientIp(request.headers);
  const ipDecision = checkIp(ip, config.allowedIps);
  if (ipDecision !== "allowed") {
    // Refused before authentication, so this is a 403 rather than a polite 200:
    // it is not a real postback and nothing should retry it.
    return text("forbidden", 403);
  }

  // ── 2. Signature ──────────────────────────────────────────────────────────
  const verdict = verifySignature(network, params, config.secret);
  if (verdict !== "ok") {
    if (verdict === "unconfirmed-spec") {
      void alert({
        severity: "critical",
        title: `Postback refused: ${network} signature spec unconfirmed`,
        detail: "Check the formula in the publisher dashboard, then set confirmed in spec.ts.",
        context: { network },
      });
    }
    return text("bad signature", 403);
  }

  // Past this line the caller is authenticated, so every answer is 200.
  try {
    const parsed = parsePostback(network, params);
    if (typeof parsed === "string") {
      void alert({
        severity: "warn",
        title: `Unparseable ${network} postback`,
        detail: parsed,
        context: { network },
      });
      return ok(network);
    }

    // ── 3, 4, 5 ─────────────────────────────────────────────────────────────
    const outcome = await applyPostback(network, parsed, params);

    if (outcome.kind === "reversed" && outcome.afterWithdrawal) {
      void alert({
        severity: "critical",
        title: `${network} reversed a reward that was already available`,
        detail: "The member has been flagged; their withdrawals now go to manual review.",
        context: { network, reward: outcome.rewardId },
      });
    }

    if (outcome.kind === "user-not-found") {
      void alert({
        severity: "warn",
        title: `${network} postback for an unknown member`,
        context: { network, txn: parsed.networkTxnId },
      });
    }

    return ok(network);
  } catch (error) {
    // §13: "Always return 200 with their expected body, even on our internal
    // errors. Log the error separately." A 500 here gets the publisher account
    // disabled, which costs the inventory the product is made of.
    Sentry.captureException(error, { tags: { network, route: "postback" } });
    void alert({
      severity: "critical",
      title: `Postback handler threw for ${network}`,
      detail: error instanceof Error ? error.message : "unknown",
      context: { network },
    });
    return ok(network);
  }
}

/** The literal body each network treats as success. */
function ok(network: Network): Response {
  const body = network === "CPX" ? "1" : "OK";
  return text(body, 200);
}

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
