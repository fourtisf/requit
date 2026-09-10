import { describe, expect, it } from "vitest";
import type { AdapterUser } from "next-auth/adapters";
import { toSessionUser } from "@/lib/auth/session-payload";

function adapterUser(overrides: Partial<AdapterUser> = {}): AdapterUser {
  // Shaped like the row PrismaAdapter hands back, including the fields that must
  // never reach the browser.
  return {
    id: "user_1",
    email: "ada@example.com",
    emailVerified: new Date("2026-09-01"),
    handle: "ada",
    countryCode: "GB",
    riskTier: "STANDARD",
    suspendedAt: null,
    ...overrides,
    // Columns the adapter row carries that the session must not.
    ...({ suspendReason: "internal note", name: null, image: null } as Partial<AdapterUser>),
  } as AdapterUser;
}

describe("toSessionUser", () => {
  it("survives a JSON round trip unchanged", () => {
    // The session is serialised on its way to the reader. Anything that is not a
    // JSON primitive — a Date above all — arrives as a different type than the
    // one TypeScript promises, and the failure shows up as a runtime crash in a
    // page rather than here.
    const payload = toSessionUser(adapterUser());
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it("derives suspension as a boolean rather than passing the timestamp", () => {
    expect(toSessionUser(adapterUser()).suspended).toBe(false);
    expect(toSessionUser(adapterUser({ suspendedAt: new Date() })).suspended).toBe(true);
  });

  it("publishes only the allowlisted fields", () => {
    // Locked deliberately. Adding a key here is a decision to expose it on
    // /api/auth/session, which is readable by anyone holding the cookie.
    expect(Object.keys(toSessionUser(adapterUser())).sort()).toEqual([
      "countryCode",
      "email",
      "handle",
      "id",
      "riskTier",
      "suspended",
    ]);
  });

  it("never carries the operator's suspension note", () => {
    const payload = toSessionUser(adapterUser({ suspendedAt: new Date() }));
    expect(JSON.stringify(payload)).not.toContain("internal note");
  });
});
