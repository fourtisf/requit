import { describe, expect, it } from "vitest";
import { redactTransport, transportProblem } from "@/lib/auth/transport";

describe("what counts as configured", () => {
  it("accepts a normal connection string", () => {
    expect(transportProblem("smtps://user%40example.com:hunter2@smtp.example.com:465")).toBeNull();
    expect(transportProblem("smtp://user:pass@smtp.example.com:587")).toBeNull();
  });

  it("accepts a relay that takes no credentials", () => {
    // A local relay, or one that authenticates by IP. Legitimate.
    expect(transportProblem("smtp://localhost:25")).toBeNull();
  });

  it("tolerates surrounding whitespace", () => {
    expect(transportProblem("  smtp://user:pass@host:587  ")).toBeNull();
  });
});

describe("the failure that actually happened", () => {
  it("refuses a username with an empty password", () => {
    // This is what a shell one-liner produces when the variable holding the
    // password was empty: `smtps://user:@host:465`. The old check — is the
    // string non-empty — called it configured, so sign-in showed a working form
    // and threw on send.
    expect(transportProblem("smtps://team%40requit.xyz:@smtp.hostinger.com:465")).toBe(
      "no-password",
    );
  });

  it("refuses a password with no username", () => {
    expect(transportProblem("smtp://:pass@host:587")).toBe("no-user");
  });
});

describe("other broken shapes", () => {
  it("names each one rather than lumping them together", () => {
    expect(transportProblem("")).toBe("unset");
    expect(transportProblem("   ")).toBe("unset");
    expect(transportProblem("smtp.hostinger.com")).toBe("malformed");
    expect(transportProblem("not a url at all")).toBe("malformed");
    expect(transportProblem("https://smtp.example.com")).toBe("bad-scheme");
    expect(transportProblem("postgres://user:pass@host/db")).toBe("bad-scheme");
  });
});

describe("redaction", () => {
  it("keeps everything an operator needs and drops the secret", () => {
    const redacted = redactTransport("smtps://team%40requit.xyz:hunter2@smtp.hostinger.com:465");
    expect(redacted).toBe("smtps://team@requit.xyz:***@smtp.hostinger.com:465");
    expect(redacted).not.toContain("hunter2");
  });

  it("says so rather than throwing on junk", () => {
    expect(redactTransport("nonsense")).toBe("(unparseable)");
  });

  it("does not invent credentials for a relay that has none", () => {
    expect(redactTransport("smtp://localhost:25")).toBe("smtp://localhost:25");
  });
});
