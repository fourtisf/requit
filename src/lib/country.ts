/**
 * Country drives offer eligibility (HANDOFF.md §4) and the public availability
 * checker (§8), so it is captured at signup from the edge header rather than
 * asked for — a self-declared country is trivially wrong and trivially gamed.
 */
export const UNKNOWN_COUNTRY = "XX";

const HEADER_CANDIDATES = [
  "cf-ipcountry", // Cloudflare — the deployment in front of us
  "x-vercel-ip-country",
  "x-country-code",
] as const;

export function countryFromHeaders(headers: Headers): string {
  for (const name of HEADER_CANDIDATES) {
    const value = headers.get(name);
    const code = normaliseCountry(value);
    if (code !== UNKNOWN_COUNTRY) return code;
  }
  return UNKNOWN_COUNTRY;
}

export function normaliseCountry(value: string | null | undefined): string {
  if (!value) return UNKNOWN_COUNTRY;

  const code = value.trim().toUpperCase();

  // Cloudflare sends T1 for Tor exits and XX when it cannot tell.
  if (!/^[A-Z]{2}$/.test(code) || code === "T1" || code === "XX") {
    return UNKNOWN_COUNTRY;
  }

  return code;
}
