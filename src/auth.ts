import NextAuth, { type DefaultSession } from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import { serverEnv } from "@/lib/env";
import { requitAdapter } from "@/lib/auth/adapter";
import { sendSignInCode } from "@/lib/auth/email";
import { OTP_TTL_SECONDS } from "@/lib/auth/otp";
import { generateOtp } from "@/lib/auth/otp.server";
import { rateLimit } from "@/lib/rate-limit";
import type { RiskTier } from "@prisma/client";

declare module "next-auth/adapters" {
  /** Our adapter returns the full Prisma row, so the product fields are present. */
  interface AdapterUser {
    handle: string;
    countryCode: string;
    riskTier: RiskTier;
    suspendedAt: Date | null;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string;
      countryCode: string;
      riskTier: RiskTier;
      suspendedAt: Date | null;
    } & DefaultSession["user"];
  }
}

/**
 * Email OTP, not a magic link.
 *
 * Auth.js's email provider generates a token, hashes it with AUTH_SECRET, stores
 * the hash, and deletes the row on first use. Substituting a 6-digit code for
 * the default opaque token keeps all of that and only changes what the user
 * copies. The code is what the user types on /signin; the callback URL is built
 * by our own form, never sent in the mail, so link prefetchers cannot burn it.
 */
const emailOtp: EmailConfig = {
  id: "otp",
  type: "email",
  name: "Email code",
  from: "", // resolved per-send from EMAIL_FROM
  server: undefined,
  maxAge: OTP_TTL_SECONDS,
  generateVerificationToken: () => generateOtp(),
  async sendVerificationRequest({ identifier, token }) {
    // 5 codes per address per 15 minutes. Mail cost, and grinding defence.
    const limit = await rateLimit(`otp:${identifier.toLowerCase()}`, 5, 15 * 60);
    if (!limit.allowed) {
      throw new Error("Too many sign-in codes requested. Try again shortly.");
    }

    await sendSignInCode({ to: identifier, code: token });
  },
  options: {},
};

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: requitAdapter(),
  secret: serverEnv().AUTH_SECRET,
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/code",
    error: "/signin",
  },
  providers: [emailOtp],
  callbacks: {
    session({ session, user }) {
      // Build the payload explicitly rather than decorating the adapter's object.
      // /api/auth/session is readable by the browser, and the raw session row
      // carries `sessionToken` — the credential itself. Mutate-and-return would
      // publish it, and adding a column to User would silently publish that too.
      return {
        expires: session.expires,
        user: {
          id: user.id,
          email: user.email,
          handle: user.handle,
          countryCode: user.countryCode,
          riskTier: user.riskTier,
          suspendedAt: user.suspendedAt,
        },
      };
    },
  },
}));
