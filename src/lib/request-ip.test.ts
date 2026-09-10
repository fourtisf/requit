import { describe, expect, it } from "vitest";
import { clientIp, hashIp } from "@/lib/request-ip";

describe("clientIp", () => {
  it("prefers the header the proxy controls", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1, 203.0.113.7",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("reads only the first hop of x-forwarded-for", () => {
    // Later hops are appended by our own proxies; the first is the client. A
    // client that forges the header can only forge its own bucket.
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.4" });
    expect(clientIp(headers)).toBe("198.51.100.1");
  });

  it("is null when no header identifies the caller", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("hashIp", () => {
  it("is stable for the same address", () => {
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
  });

  it("separates different addresses", () => {
    expect(hashIp("203.0.113.7")).not.toBe(hashIp("203.0.113.8"));
  });

  it("does not contain the address it came from", () => {
    expect(hashIp("203.0.113.7")).not.toContain("203");
  });
});
