import { describe, expect, it } from "vitest";
import { checkIp } from "@/lib/networks/config";

describe("checkIp", () => {
  const allowed = ["203.0.113.10", "203.0.113.11"];

  it("allows a listed address", () => {
    expect(checkIp("203.0.113.10", allowed)).toBe("allowed");
  });

  it("denies an unlisted address", () => {
    expect(checkIp("198.51.100.4", allowed)).toBe("denied");
  });

  it("denies when the address is unknown", () => {
    expect(checkIp(null, allowed)).toBe("denied");
  });

  it("reports an empty allowlist rather than allowing everything", () => {
    // Treating "not configured" as "allow all" turns a forgotten environment
    // variable into an open endpoint that credits rewards to whoever calls it.
    expect(checkIp("203.0.113.10", [])).toBe("no-allowlist");
    expect(checkIp(null, [])).toBe("no-allowlist");
  });
});
