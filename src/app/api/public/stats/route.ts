import type { NextRequest } from "next/server";
import { publicJson } from "@/lib/public-route";
import { publicStats } from "@/lib/public-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return publicJson(request, "stats", () => publicStats());
}
