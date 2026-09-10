import "server-only";
import { randomInt } from "node:crypto";
import { OTP_LENGTH } from "@/lib/auth/otp";

/**
 * A 6-digit code from a CSPRNG. `randomInt` is rejection-sampled, so every code
 * is equally likely — `Math.random()` and modulo-biased alternatives are not
 * acceptable here.
 *
 * Auth.js hashes the code with the app secret before it is stored, and deletes
 * the row on first use. That is what makes it single-use; do not add a second
 * store of your own.
 */
export function generateOtp(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}
