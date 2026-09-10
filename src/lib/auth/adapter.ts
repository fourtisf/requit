import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { allocateHandle } from "@/lib/handle";
import { countryFromHeaders, UNKNOWN_COUNTRY } from "@/lib/country";

/**
 * PrismaAdapter cannot create our User rows on its own: `handle` and
 * `countryCode` are required and it knows about neither. This wrapper fills them
 * in and leaves every other adapter method untouched.
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

      const created = await prisma.user.create({
        data: {
          email,
          handle,
          countryCode: await signupCountry(),
          emailVerified: user.emailVerified ?? null,
          name: user.name ?? null,
          image: user.image ?? null,
        },
      });

      return created as AdapterUser;
    },
  };
}

/**
 * Country is read from the edge header on the request that completed sign-up.
 * Read here rather than passed in, because Auth.js owns the call site.
 *
 * Unknown is a legitimate outcome (direct origin hit, a proxy that strips the
 * header). The dashboard asks the user to set it; offers stay hidden until it is
 * known, since eligibility is country-scoped.
 */
async function signupCountry(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    return countryFromHeaders(await headers());
  } catch {
    return UNKNOWN_COUNTRY;
  }
}
