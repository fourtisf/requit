import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({ auth: authMock }));

// next/navigation's redirect signals by throwing. Reproduce that here so a
// caller that fails to stop after redirecting is caught by the test.
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

const { requireUser, currentUser } = await import("@/lib/session");

function session(overrides: Record<string, unknown> = {}) {
  return {
    expires: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: "user_1",
      email: "ada@example.com",
      handle: "ada",
      countryCode: "GB",
      riskTier: "STANDARD",
      suspended: false,
      ...overrides,
    },
  };
}

beforeEach(() => {
  authMock.mockReset();
});

describe("requireUser", () => {
  it("returns the user when the session is good", async () => {
    authMock.mockResolvedValue(session());
    await expect(requireUser()).resolves.toMatchObject({ handle: "ada" });
  });

  it("sends an anonymous visitor to sign in", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/signin");
  });

  it("sends a suspended user to the appeal page, not the dashboard", async () => {
    authMock.mockResolvedValue(session({ suspended: true }));
    await expect(requireUser()).rejects.toThrow("REDIRECT:/suspended");
  });

  it("does not treat a flagged user as suspended — flagged still earns", async () => {
    // HANDOFF.md §7: FLAGGED sends withdrawals to manual review. It is not a ban,
    // and locking a flagged user out of the product would be one.
    authMock.mockResolvedValue(session({ riskTier: "FLAGGED" }));
    await expect(requireUser()).resolves.toMatchObject({ riskTier: "FLAGGED" });
  });
});

describe("currentUser", () => {
  it("is null rather than a redirect when signed out", async () => {
    authMock.mockResolvedValue(null);
    await expect(currentUser()).resolves.toBeNull();
  });
});
