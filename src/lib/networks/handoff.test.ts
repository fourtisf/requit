import { describe, expect, it } from "vitest";
import { SUBID_SPECS, buildHandoff, canHandOff, withSpec } from "@/lib/networks/handoff";
import { Network } from "@prisma/client";

const NETWORKS = Object.values(Network);

const click = "https://track.example.com/click?oid=99";

// The specs ship unconfirmed on purpose, so every behavioural test stands one
// up rather than relying on — or editing — the shipped value.
const SPEC = { param: "user_id", confirmed: true } as const;

describe("the shipped specs", () => {
  it("are all unconfirmed, so connecting a network is a deliberate diff", () => {
    // Same guard as the signature specs. A sub-id parameter that could be wrong
    // without anyone noticing sends members out on links that credit nobody.
    for (const network of NETWORKS) {
      expect(SUBID_SPECS[network].confirmed, network).toBe(false);
    }
  });

  it("names a parameter for every network the schema knows", () => {
    for (const network of NETWORKS) {
      expect(SUBID_SPECS[network].param.length, network).toBeGreaterThan(0);
    }
  });
});

describe("refusing the handoff", () => {
  it("refuses while the spec is unconfirmed, even with a good link", () => {
    // The important one. A member who plays for a week and is told the network
    // has no record of them does not come back.
    expect(buildHandoff({ network: "TOROX", trackingUrl: click, userId: "u1" })).toEqual({
      ok: false,
      reason: "unconfirmed-spec",
    });
  });

  it("refuses an offer with no link", () => {
    expect(buildHandoff({ network: "TOROX", trackingUrl: null, userId: "u1" })).toEqual({
      ok: false,
      reason: "no-url",
    });
  });

  it("checks the link before the spec is even consulted", () => {
    // no-url beats unconfirmed-spec: the more specific fact is the useful one.
    expect(buildHandoff({ network: "CPX", trackingUrl: "", userId: "u1" }).ok).toBe(false);
  });
});

describe("building the link", () => {
  const build = (trackingUrl: string | null, userId = "usr_123") =>
    withSpec(SPEC, trackingUrl, userId);

  it("carries the member id on the network's own parameter", () => {
    const result = build(click);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const url = new URL(result.url);
    expect(url.searchParams.get(SPEC.param)).toBe("usr_123");
    expect(url.searchParams.get("oid")).toBe("99");
  });

  it("replaces a placeholder already in the feed URL rather than adding a second", () => {
    // Two copies of the parameter is a coin flip over which one the network
    // reads, and losing that flip means the conversion lands on nobody.
    const result = build(`https://track.example.com/click?${SPEC.param}={subid}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.url.match(new RegExp(SPEC.param, "g"))).toHaveLength(1);
    expect(result.url).not.toContain("{subid}");
  });

  it("escapes an id that would otherwise break the query string", () => {
    const result = build(click, "a&b=c d");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(new URL(result.url).searchParams.get(SPEC.param)).toBe("a&b=c d");
  });

  it("refuses http, which would put the member id in cleartext", () => {
    expect(build("http://track.example.com/click")).toEqual({ ok: false, reason: "bad-url" });
  });

  it("refuses something that is not a URL at all", () => {
    expect(build("track.example.com/click")).toEqual({ ok: false, reason: "bad-url" });
    expect(build("javascript:alert(1)")).toEqual({ ok: false, reason: "bad-url" });
  });
});

describe("canHandOff", () => {
  it("is false for every network today, so no button renders as live", () => {
    for (const network of NETWORKS) {
      expect(canHandOff(network, click), network).toBe(false);
    }
  });
});
