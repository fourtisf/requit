import NextAuth, { type DefaultSession } from "next-auth";
import type { EmailConfig } from "next-auth/providers";
import { serverEnv } from "@/lib/env";
import { requitAdapter } from "@/lib/auth/adapter";
import { sendSignInCode } from "@/lib/auth/email";
import { OTP_TTL_SECONDS } from "@/lib/auth/otp";
import { generateOtp } from "@/lib/auth/otp.server";
import { toSessionUser } from "@/lib/auth/session-payload";
import { rateLimitAll } from "@/lib/rate-limit";
import { clientIp, hashIp } from "@/lib/request-ip";
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
      /**
       * The decision, not the timestamp. The session payload is serialised to
       * JSON, so a Date here arrives at the reader as a string while still
       * being typed as a Date. Pages that need the date or the reason read
       * them from the row.
       */
      suspended: boolean;
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
    const email = identifier.toLowerCase();
    const rules = [
      // Per address: mail cost, and grinding defence for one inbox.
      { key: `otp:email:${email}`, limit: 5, windowSeconds: 15 * 60 },
    ];

    // Per source: the per-address limit alone is bypassed by rotating the
    // address, which costs the attacker nothing and costs us an email each time.
    const ip = await requestIpHash();
    if (ip) {
      rules.push({ key: `otp:ip:${ip}`, limit: 20, windowSeconds: 60 * 60 });
    }

    const limit = await rateLimitAll(rules);
    if (!limit.allowed) {
      throw new Error("Too many sign-in codes requested. Try again shortly.");
    }

    await sendSignInCode({ to: identifier, code: token });
  },
  options: {},
};

/**
 * Auth.js owns the call site, so the request headers are reached the same way
 * the adapter reaches them. Returns null when there is no request context.
 */
async function requestIpHash(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const ip = clientIp(await headers());
    return ip ? hashIp(ip) : null;
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: requitAdapter(),
  secret: serverEnv().AUTH_SECRET,
  // Required behind Cloudflare and Nginx. serverEnv() refuses to boot in
  // production without AUTH_URL, which pins the origin this would otherwise
  // take from the Host header.
  trustHost: true,
  session: { strategy: "database" },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/code",
    error: "/signin",
  },
  providers: [emailOtp],
  callbacks: {
    session({ session, user }) {
      // See toSessionUser: allowlisted fields, JSON primitives only.
      return { expires: session.expires, user: toSessionUser(user) };
    },
  },
}));
