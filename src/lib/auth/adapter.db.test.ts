import { beforeEach, describe, expect, it } from "vitest";
import type { AdapterUser } from "next-auth/adapters";
import { requitAdapter } from "@/lib/auth/adapter";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import { prisma, resetDatabase } from "@/test/db";

const adapter = requitAdapter();

/**
 * Auth.js types `createUser` as taking a full `AdapterUser`, but at the email
 * callback it constructs `{ id, email, emailVerified }` and nothing else — the
 * remaining fields are what an adapter is expected to produce. Our augmentation
 * declares handle/countryCode/riskTier because every user that EXISTS has them;
 * this cast reproduces what Auth.js actually passes in, which is the input the
 * adapter has to cope with.
 */
function asCreateInput(user: { id: string; email: string; emailVerified: Date | null }) {
  return user as unknown as AdapterUser;
}

function createUser(email: string) {
  if (!adapter.createUser) throw new Error("adapter is missing createUser");
  return adapter.createUser(
    asCreateInput({ id: crypto.randomUUID(), email, emailVerified: new Date() }),
  );
}

beforeEach(async () => {
  await resetDatabase();
});

describe("requitAdapter.createUser", () => {
  it("fills in the columns PrismaAdapter knows nothing about", async () => {
    const user = await createUser("ada@example.com");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.handle).toBe("ada");
    expect(stored.riskTier).toBe("NEW");
    expect(stored.emailVerified).not.toBeNull();
  });

  it("suffixes a handle that is already taken", async () => {
    await createUser("ada@example.com");
    const second = await createUser("ada@other.example");

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: second.id } });
    expect(stored.handle).toBe("ada_2");
  });

  it("records the country as unknown when there is no request context", async () => {
    // Vitest is not a request, so the edge header cannot be read. Unknown is the
    // correct outcome — the alternative is inventing a country that then filters
    // the user's offer inventory.
    const user = await createUser("ada@example.com");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.countryCode).toBe(UNKNOWN_COUNTRY);
  });

  it("refuses a user with no email", async () => {
    if (!adapter.createUser) throw new Error("adapter is missing createUser");
    await expect(
      adapter.createUser(asCreateInput({ id: crypto.randomUUID(), email: "", emailVerified: null })),
    ).rejects.toThrow(/without an email/i);
  });

  it("rejects a duplicate email rather than creating a second account", async () => {
    await createUser("ada@example.com");
    await expect(createUser("ada@example.com")).rejects.toThrow();
    expect(await prisma.user.count()).toBe(1);
  });
});
