import { describe, expect, it } from "vitest";
import {
  decideAttribution,
  generateReferralCode,
  normaliseReferralCode,
  referralUrl,
  REFERRAL_ALPHABET,
  REFERRAL_CODE_LENGTH,
} from "@/lib/referral";

describe("generateReferralCode", () => {
  it("only ever uses the non-confusable alphabet", () => {
    for (let i = 0; i < 2_000; i += 1) {
      const code = generateReferralCode();
      expect(code).toHaveLength(REFERRAL_CODE_LENGTH);
      expect([...code].every((char) => REFERRAL_ALPHABET.includes(char))).toBe(true);
    }
  });

  it("excludes the four characters people mistype when reading a code aloud", () => {
    expect(REFERRAL_ALPHABET).not.toMatch(/[ILOU]/);
  });
});

describe("normaliseReferralCode", () => {
  it("accepts the code as generated", () => {
    const code = generateReferralCode();
    expect(normaliseReferralCode(code)).toBe(code);
  });

  it("forgives what people actually type", () => {
    // Lowercase, a dash someone added, and the three characters Crockford maps
    // back. Rejecting these would be a self-inflicted support ticket.
    expect(normaliseReferralCode("abcd-2345")).toBe("ABCD2345");
    expect(normaliseReferralCode("i2345678")).toBe("12345678");
    expect(normaliseReferralCode("l2345678")).toBe("12345678");
    expect(normaliseReferralCode("o2345678")).toBe("02345678");
    expect(normaliseReferralCode("  ABCD2345  ")).toBe("ABCD2345");
  });

  it.each(["", "SHORT", "WAYTOOLONGCODE", "ABCD234!"])("rejects %s", (value) => {
    expect(normaliseReferralCode(value)).toBeNull();
  });
});

describe("decideAttribution", () => {
  const referrer = { id: "referrer_1", suspendedAt: null, signupIpHash: "hash-a" };

  it("credits a genuine referral", () => {
    expect(decideAttribution(referrer, { signupIpHash: "hash-b" })).toEqual({
      attributed: true,
      referrerId: "referrer_1",
    });
  });

  it("ignores a code nobody owns", () => {
    expect(decideAttribution(null, { signupIpHash: "hash-b" })).toEqual({
      attributed: false,
      reason: "unknown-code",
    });
  });

  it("refuses to keep paying a suspended referrer", () => {
    expect(
      decideAttribution({ ...referrer, suspendedAt: new Date() }, { signupIpHash: "hash-b" }),
    ).toEqual({ attributed: false, reason: "referrer-suspended" });
  });

  it("refuses the self-referral case — same source as the referrer's own signup", () => {
    expect(decideAttribution(referrer, { signupIpHash: "hash-a" })).toEqual({
      attributed: false,
      reason: "same-source",
    });
  });

  it("does not treat two unknown sources as the same source", () => {
    // Both null must never compare equal, or every signup behind a header-
    // stripping proxy would be refused as a self-referral.
    expect(
      decideAttribution({ ...referrer, signupIpHash: null }, { signupIpHash: null }),
    ).toMatchObject({ attributed: true });
  });
});

describe("referralUrl", () => {
  it("puts the code on the landing page", () => {
    expect(referralUrl("https://requit.com", "ABCD2345")).toBe(
      "https://requit.com/?ref=ABCD2345",
    );
  });
});
