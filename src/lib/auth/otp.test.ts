import { describe, expect, it } from "vitest";
import { formatOtpForDisplay, isWellFormedOtp, OTP_LENGTH } from "@/lib/auth/otp";
import { generateOtp } from "@/lib/auth/otp.server";

describe("generateOtp", () => {
  it("always produces exactly OTP_LENGTH digits", () => {
    for (let i = 0; i < 2_000; i += 1) {
      const code = generateOtp();
      expect(code).toHaveLength(OTP_LENGTH);
      expect(isWellFormedOtp(code)).toBe(true);
    }
  });

  it("covers the low end of the range — leading zeros must survive padding", () => {
    // Not a distribution test; it only proves padding is applied, which a naive
    // String(randomInt(...)) would drop and shorten the code.
    const codes = Array.from({ length: 5_000 }, generateOtp);
    expect(codes.every((code) => code.length === OTP_LENGTH)).toBe(true);
    expect(new Set(codes).size).toBeGreaterThan(4_000);
  });
});

describe("isWellFormedOtp", () => {
  it.each(["12345", "1234567", "12345a", "", " 123456"])("rejects %s", (value) => {
    expect(isWellFormedOtp(value)).toBe(false);
  });
});

describe("formatOtpForDisplay", () => {
  it("splits the code in half", () => {
    expect(formatOtpForDisplay("123456")).toBe("123 456");
  });
});
