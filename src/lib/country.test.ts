import { describe, expect, it } from "vitest";
import { countryFromHeaders, normaliseCountry, UNKNOWN_COUNTRY } from "@/lib/country";

describe("normaliseCountry", () => {
  it("accepts a well-formed ISO-2 code", () => {
    expect(normaliseCountry("gb")).toBe("GB");
  });

  it.each([null, undefined, "", "USA", "1", "T1", "XX"])("rejects %s", (value) => {
    expect(normaliseCountry(value)).toBe(UNKNOWN_COUNTRY);
  });
});

describe("countryFromHeaders", () => {
  it("prefers the Cloudflare header", () => {
    const headers = new Headers({ "cf-ipcountry": "DE", "x-vercel-ip-country": "US" });
    expect(countryFromHeaders(headers)).toBe("DE");
  });

  it("falls through when the first header is unusable", () => {
    const headers = new Headers({ "cf-ipcountry": "T1", "x-vercel-ip-country": "US" });
    expect(countryFromHeaders(headers)).toBe("US");
  });

  it("is unknown when no header is present", () => {
    expect(countryFromHeaders(new Headers())).toBe(UNKNOWN_COUNTRY);
  });
});
