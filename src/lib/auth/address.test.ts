import { describe, expect, it } from "vitest";
import { addressProblem, isSendableAddress } from "@/lib/auth/address";

describe("ordinary addresses still work", () => {
  it("accepts what real people sign up with", () => {
    for (const address of [
      "ada@example.com",
      "ada.lovelace@example.co.uk",
      "ada+requit@example.com",
      "a@b.io",
      "first.last-name_1@sub.domain.example.org",
      "ADA@EXAMPLE.COM",
    ]) {
      expect(addressProblem(address), address).toBeNull();
    }
  });

  it("tolerates surrounding whitespace, which a paste always has", () => {
    expect(isSendableAddress("  ada@example.com  ")).toBe(true);
  });
});

describe("the shapes the nodemailer advisories need", () => {
  it("refuses a list, which is what the quadratic parse is fed", () => {
    // GHSA-2x7j-588g-ccc2: addressparser goes quadratic on a crafted list. A
    // list cannot reach it if a comma is refused outright.
    expect(addressProblem("a@example.com,b@evil.com")).toBe("has-structure");
    expect(addressProblem("a@example.com;b@evil.com")).toBe("has-structure");
    expect(addressProblem(`${"a@b.com,".repeat(5000)}c@d.com`)).toBe("too-long");
  });

  it("refuses RFC 5322 comments, which move the real domain", () => {
    // GHSA-cc9r-2j5m-2m83: a parser that strips comments reads a different
    // domain than one that does not. Neither gets the chance here.
    expect(addressProblem("ada@example.com(.evil.com)")).toBe("has-structure");
    expect(addressProblem("ada(comment)@example.com")).toBe("has-structure");
    expect(addressProblem("<ada@example.com>")).toBe("has-structure");
    expect(addressProblem('"Ada" <ada@example.com>')).toBe("has-structure");
    expect(addressProblem("group:ada@example.com;")).toBe("has-structure");
  });

  it("refuses non-ASCII, which the punycode bypass is built on", () => {
    // GHSA-wmmp-3585-3rmp. The domain below carries a Cyrillic a, which renders
    // identically to the Latin one.
    const cyrillicA = String.fromCharCode(0x0430);
    expect(addressProblem(`ada@ex${cyrillicA}mple.com`)).toBe("non-ascii");
    // Already-encoded punycode is plain ASCII and stays allowed.
    expect(addressProblem("ada@xn--e1awd7f.com")).toBeNull();
  });

  it("refuses control characters and header injection", () => {
    const crlf = String.fromCharCode(13, 10);
    expect(addressProblem(`ada@example.com${crlf}Bcc: evil@evil.com`)).toBe("has-structure");
    expect(addressProblem("ada @example.com")).toBe("has-structure");
  });

  it("bounds length, so nothing quadratic gets a large n", () => {
    expect(addressProblem(`${"a".repeat(250)}@example.com`)).toBe("too-long");
    expect(addressProblem(`${"a".repeat(65)}@example.com`)).toBe("too-long");
  });
});

describe("malformed addresses", () => {
  it("refuses what is not a single mailbox", () => {
    for (const address of [
      "",
      "   ",
      "ada",
      "@example.com",
      "ada@",
      "ada@@example.com",
      "ada@example",
      "ada@.com",
      "ada@example..com",
      "ada@-example.com",
      "ada@example-.com",
      "ada@example.c0m",
      ".ada@example.com",
      "ada.@example.com",
      "ada..lovelace@example.com",
    ]) {
      expect(addressProblem(address), address).not.toBeNull();
    }
  });
});
