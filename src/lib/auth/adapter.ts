import { randomUUID } from "node:crypto";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { allocateHandle } from "@/lib/handle";
import { countryFromHeaders, UNKNOWN_COUNTRY } from "@/lib/country";
import { clientIp, hashIp } from "@/lib/request-ip";
import { REFERRAL_COOKIE } from "@/lib/referral-cookie";
import { decideAttribution, generateReferralCode, normaliseReferralCode } from "@/lib/referral";

/**
 * PrismaAdapter cannot create our User rows on its own: `handle`,
 * `countryCode`, `referralCode` and `unsubscribeToken` are all required and it
 * knows about none of them. This wrapper fills them in and leaves every other
 * adapter method untouched.
 */
export function requitAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    async createUser(user) {
      const email = user.email;
      if (!email) {
        throw new Error("Cannot create a user without an email address");
      }

      const handle = await allocateHandle(email, async (candidate) => {
        const existing = await prisma.user.findUnique({
          where: { handle: candidate },
          select: { id: true },
        });
        return existing !== null;
      });

      const request = await requestFacts();
      const referrerId = await resolveReferrer(request);

      const created = await prisma.user.create({
        data: {
          email,
          handle,
          countryCode: request.countryCode,
          signupIpHash: request.ipHash,
          referralCode: await allocateReferralCode(),
          unsubscribeToken: randomUUID(),
          referredById: referrerId,
          referredAt: referrerId ? new Date() : null,
          emailVerified: user.emailVerified ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
        },
      });

      return created as AdapterUser;
    },
  };
}

type RequestFacts = {
  countryCode: string;
  ipHash: string | null;
  referralCode: string | null;
};

/**
 * Everything read off the signup request.
 *
 * Read here rather than passed in, because Auth.js owns the call site. Outside a
 * request — a unit test, a script — every field is simply absent, which the
 * callers below all treat as a legitimate outcome.
 */
async function requestFacts(): Promise<RequestFacts> {
  try {
    const { headers, cookies } = await import("next/headers");
    const headerList = await headers();
    const ip = clientIp(headerList);
    const cookieValue = (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;

    return {
      countryCode: countryFromHeaders(headerList),
      ipHash: ip ? hashIp(ip) : null,
      referralCode: cookieValue ? normaliseReferralCode(cookieValue) : null,
    };
  } catch {
    return { countryCode: UNKNOWN_COUNTRY, ipHash: null, referralCode: null };
  }
}

/**
 * Attribution never blocks a signup. A refused referral means the account is
 * created uncredited — see decideAttribution for why blocking would be wrong.
 */
async function resolveReferrer(request: RequestFacts): Promise<string | null> {
  if (!request.referralCode) return null;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: request.referralCode },
    select: { id: true, suspendedAt: true, signupIpHash: true },
  });

  const decision = decideAttribution(referrer, { signupIpHash: request.ipHash });
  return decision.attributed ? decision.referrerId : null;
}

async function allocateReferralCode(): Promise<string> {
  // 8 characters of base32 is 40 bits, so a collision needs roughly a million
  // users before it is worth thinking about. Retrying a handful of times covers
  // it without a loop that could spin.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateReferralCode();
    const taken = await prisma.user.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  throw new Error("Could not allocate a unique referral code");
}
