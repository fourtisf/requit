import type { NextRequest } from "next/server";
import { publicJson } from "@/lib/public-route";
import { sla } from "@/lib/public-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** §8: our real dispute response times, rolling 90 days. */
export async function GET(request: NextRequest) {
  return publicJson(request, "sla", () => sla());
}
