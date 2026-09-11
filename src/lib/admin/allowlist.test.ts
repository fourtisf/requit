import { afterEach, describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "@/lib/admin/allowlist";

const ORIGINAL = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe("isAdminEmail", () => {
  it("refuses everyone when the allowlist is unset", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("anyone@example.com")).toBe(false);
  });

  it("refuses everyone when the allowlist is empty", () => {
    // The dangerous reading of an empty list is "no restriction". This panel
    // can suspend accounts and release money, so it has to fail closed.
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("anyone@example.com")).toBe(false);
    process.env.ADMIN_EMAILS = "  ,  , ";
    expect(isAdminEmail("anyone@example.com")).toBe(false);
  });

  it("matches regardless of case and surrounding space", () => {
    process.env.ADMIN_EMAILS = " Ops@Example.com , second@example.com ";
    expect(isAdminEmail("ops@example.com")).toBe(true);
    expect(isAdminEmail("OPS@EXAMPLE.COM")).toBe(true);
    expect(isAdminEmail("second@example.com")).toBe(true);
  });

  it("refuses an address that is not on the list", () => {
    process.env.ADMIN_EMAILS = "ops@example.com";
    expect(isAdminEmail("ops@example.com.evil.com")).toBe(false);
    expect(isAdminEmail("nops@example.com")).toBe(false);
  });

  it("refuses a missing address", () => {
    process.env.ADMIN_EMAILS = "ops@example.com";
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("reads the list fresh, so a deploy that changes it takes effect", () => {
    process.env.ADMIN_EMAILS = "one@example.com";
    expect(adminEmails()).toEqual(["one@example.com"]);
    process.env.ADMIN_EMAILS = "two@example.com";
    expect(adminEmails()).toEqual(["two@example.com"]);
  });
});
