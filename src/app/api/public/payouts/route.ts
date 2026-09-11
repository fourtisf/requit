import type { NextRequest } from "next/server";
import { publicJson } from "@/lib/public-route";
import { recentPayouts } from "@/lib/public-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** §8: the last twelve settled withdrawals, each checkable on chain. */
export async function GET(request: NextRequest) {
  return publicJson(request, "payouts", async () => ({ payouts: await recentPayouts() }));
}
