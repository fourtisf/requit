import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailTransportMissingError, emailTransportConfigured, sendSignInCode } from "@/lib/auth/email";
import { resetServerEnvCache } from "@/lib/env";

/**
 * Restores the individual keys it touched. Reassigning `process.env` wholesale
 * does not reliably put it back under Vitest, and a leaked NODE_ENV=production
 * then fails every later test in the file for the wrong reason.
 */
function withEnv(overrides: Record<string, string>) {
  const previous = new Map(Object.keys(overrides).map((key) => [key, process.env[key]]));
  Object.assign(process.env, overrides);
  resetServerEnvCache();

  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetServerEnvCache();
  };
}

afterEach(() => {
  resetServerEnvCache();
  vi.restoreAllMocks();
});

describe("sendSignInCode with no transport", () => {
  it("refuses in production rather than logging the code", async () => {
    // The code is a credential. A production log line containing it lets anyone
    // who can read /var/log sign in as anyone — so this must throw, and must
    // not print.
    const restore = withEnv({ NODE_ENV: "production", EMAIL_SERVER: "", AUTH_URL: "https://requit.xyz" });
    const log = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(sendSignInCode({ to: "ada@example.com", code: "123456" })).rejects.toBeInstanceOf(
      EmailTransportMissingError,
    );
    expect(log).not.toHaveBeenCalled();

    restore();
  });

  it("logs the code in development, so the flow is testable without SMTP", async () => {
    const restore = withEnv({ NODE_ENV: "development", EMAIL_SERVER: "" });
    const log = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(sendSignInCode({ to: "ada@example.com", code: "123456" })).resolves.toBeUndefined();
    expect(log.mock.calls.at(0)?.[0]).toContain("123456");

    restore();
  });
});

describe("emailTransportConfigured", () => {
  it("is false with no server and true with one", () => {
    let restore = withEnv({ EMAIL_SERVER: "" });
    expect(emailTransportConfigured()).toBe(false);
    restore();

    restore = withEnv({ EMAIL_SERVER: "smtp://user:pass@smtp.example.com:587" });
    expect(emailTransportConfigured()).toBe(true);
    restore();
  });
});
