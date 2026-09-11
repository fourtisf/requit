import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  demandByCountry,
  isWaiting,
  notifyLiveCountries,
  registerInterest,
  waitingIn,
} from "@/lib/interest";
import { makeUser, prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

let seq = 0;
async function member(countryCode = "ID", overrides: Record<string, unknown> = {}) {
  seq += 1;
  return makeUser({
    email: `m${seq}@example.com`,
    handle: `m${seq}`,
    countryCode,
    ...overrides,
  });
}

async function liveOffer(countries: string[]) {
  return prisma.offer.create({
    data: {
      network: "TOROX",
      networkOfferId: `o-${Math.random()}`,
      name: "Kingdom builder",
      category: "GAME",
      countries,
      devices: ["android"],
      advertiserPays: new Prisma.Decimal("100"),
      userPays: new Prisma.Decimal("60"),
    },
  });
}

describe("registering interest", () => {
  it("records it and reports how many are waiting", async () => {
    const user = await member("ID");

    const result = await registerInterest({ userId: user.id, countryCode: "ID" });

    expect(result).toEqual({ ok: true, alreadyWaiting: false, waiting: 1 });
    expect(await isWaiting(user.id, "ID")).toBe(true);
  });

  it("treats a second ask as the same ask", async () => {
    const user = await member("ID");
    await registerInterest({ userId: user.id, countryCode: "ID" });

    const again = await registerInterest({ userId: user.id, countryCode: "ID" });

    expect(again).toEqual({ ok: true, alreadyWaiting: true, waiting: 1 });
    expect(await prisma.countryInterest.count()).toBe(1);
  });

  it("holds when two clicks race", async () => {
    const user = await member("ID");

    const results = await Promise.all([
      registerInterest({ userId: user.id, countryCode: "ID" }),
      registerInterest({ userId: user.id, countryCode: "ID" }),
      registerInterest({ userId: user.id, countryCode: "ID" }),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(await prisma.countryInterest.count()).toBe(1);
  });

  it("counts people, not rows per person", async () => {
    for (let index = 0; index < 3; index += 1) {
      const user = await member("ID");
      await registerInterest({ userId: user.id, countryCode: "ID" });
    }
    expect(await waitingIn("ID")).toBe(3);
    expect(await waitingIn("GB")).toBe(0);
  });

  it("refuses when tasks already exist there", async () => {
    // Offering to tell someone about tasks they can already see would be a
    // promise we have already kept.
    await liveOffer(["ID"]);
    const user = await member("ID");

    expect(await registerInterest({ userId: user.id, countryCode: "ID" })).toEqual({
      ok: false,
      reason: "already-live",
    });
  });

  it("refuses an unknown country", async () => {
    const user = await member("XX");
    expect(await registerInterest({ userId: user.id, countryCode: "XX" })).toEqual({
      ok: false,
      reason: "unknown-country",
    });
  });

  it("refuses a suspended member", async () => {
    const user = await member("ID", { suspendedAt: new Date(), suspendReason: "Under review." });
    expect(await registerInterest({ userId: user.id, countryCode: "ID" })).toEqual({
      ok: false,
      reason: "suspended",
    });
  });
});

describe("demand by country", () => {
  it("ranks by who is still waiting, not by total", async () => {
    for (const country of ["ID", "ID", "ID", "GB", "GB", "PH"]) {
      const user = await member(country);
      await registerInterest({ userId: user.id, countryCode: country });
    }

    // Two of the three in ID have already been told, so ID is no longer the
    // country with the most outstanding demand.
    const indonesian = await prisma.countryInterest.findMany({
      where: { countryCode: "ID" },
      take: 2,
    });
    await prisma.countryInterest.updateMany({
      where: { id: { in: indonesian.map((row) => row.id) } },
      data: { notifiedAt: new Date() },
    });

    const demand = await demandByCountry();
    expect(demand).toEqual([
      { countryCode: "GB", waiting: 2, notified: 0 },
      { countryCode: "ID", waiting: 1, notified: 2 },
      { countryCode: "PH", waiting: 1, notified: 0 },
    ]);
  });

  it("is empty before anyone asks", async () => {
    expect(await demandByCountry()).toEqual([]);
  });
});

describe("telling people their country opened", () => {
  it("notifies only the countries that actually have offers", async () => {
    const waitingHere = await member("ID");
    const waitingElsewhere = await member("GB");
    await registerInterest({ userId: waitingHere.id, countryCode: "ID" });
    await registerInterest({ userId: waitingElsewhere.id, countryCode: "GB" });

    await liveOffer(["ID"]);

    expect(await notifyLiveCountries()).toEqual({ notified: 1 });

    const indonesian = await prisma.countryInterest.findFirstOrThrow({
      where: { countryCode: "ID" },
    });
    const british = await prisma.countryInterest.findFirstOrThrow({ where: { countryCode: "GB" } });
    expect(indonesian.notifiedAt).toBeInstanceOf(Date);
    expect(british.notifiedAt).toBeNull();
  });

  it("never tells the same person twice", async () => {
    // Being mailed the same announcement repeatedly is how an address marks a
    // sender as spam, and the stamp is what prevents it.
    const user = await member("ID");
    await registerInterest({ userId: user.id, countryCode: "ID" });
    await liveOffer(["ID"]);

    expect(await notifyLiveCountries()).toEqual({ notified: 1 });
    expect(await notifyLiveCountries()).toEqual({ notified: 0 });
    expect(await notifyLiveCountries()).toEqual({ notified: 0 });
  });

  it("does nothing when no offer is live", async () => {
    const user = await member("ID");
    await registerInterest({ userId: user.id, countryCode: "ID" });

    expect(await notifyLiveCountries()).toEqual({ notified: 0 });
  });

  it("ignores an offer that has been switched off", async () => {
    const user = await member("ID");
    await registerInterest({ userId: user.id, countryCode: "ID" });
    const offer = await liveOffer(["ID"]);
    await prisma.offer.update({ where: { id: offer.id }, data: { isActive: false } });

    expect(await notifyLiveCountries()).toEqual({ notified: 0 });
  });
});
