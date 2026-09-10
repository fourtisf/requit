/**
 * Shared OTP vocabulary — safe to import from client components.
 *
 * Generation lives in `otp.server.ts` because it needs a CSPRNG from node:crypto,
 * and pulling that into the client bundle breaks the build.
 */
export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 10 * 60;

export function isWellFormedOtp(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}

/** Splits 123456 into "123 456" for the email body. Easier to read back. */
export function formatOtpForDisplay(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}
