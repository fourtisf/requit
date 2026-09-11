import type { NextRequest } from "next/server";
import { publicJson } from "@/lib/public-route";
import { availability } from "@/lib/public-stats";
import { UNKNOWN_COUNTRY } from "@/lib/country";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** §8: what someone in a country can expect, answerable before they sign up. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("country") ?? "";
  const country = raw.trim().toUpperCase();

  // Normalised into the cache key so `?country=us` and `?country=US` are one
  // entry, and anything malformed collapses to a single well-known key rather
  // than letting a caller mint unlimited cache entries.
  const valid = /^[A-Z]{2}$/.test(country) ? country : UNKNOWN_COUNTRY;

  return publicJson(request, `availability:${valid}`, () => availability(valid));
}
