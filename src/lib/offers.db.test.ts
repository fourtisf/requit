import { beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { offersFor, recordStart } from "@/lib/offers";
import { prisma, resetDatabase } from "@/test/db";

beforeEach(async () => {
  await resetDatabase();
});

async function offer(overrides: Partial<Prisma.OfferCreateInput> & { networkOfferId: string }) {
  return prisma.offer.create({
    data: {
      network: "TOROX",
      name: "An offer",
      category: "GAME",
      countries: [],
      devices: [],
      advertiserPays: new Prisma.Decimal("10.0000"),
      userPays: new Prisma.Decimal("6.5000"),
      ...overrides,
    },
    select: { id: true },
  });
}

describe("offersFor", () => {
  it("shows nothing when the country is unknown", async () => {
    // Offers are matched by country. Showing work a member cannot be paid for
    // is the complaint this product exists to avoid.
    await offer({ networkOfferId: "a" });
    expect(await offersFor({ countryCode: "XX" })).toEqual([]);
  });

  it("includes offers with an empty country list — those are everywhere", async () => {
    await offer({ networkOfferId: "a", countries: [] });
    expect(await offersFor({ countryCode: "GB" })).toHaveLength(1);
  });

  it("matches the member's country and excludes others", async () => {
    await offer({ networkOfferId: "gb", countries: ["GB"] });
    await offer({ networkOfferId: "us", countries: ["US"] });

    const rows = await offersFor({ countryCode: "GB" });
    expect(rows).toHaveLength(1);
  });

  it("excludes inactive offers rather than deleting them", async () => {
    // The sync marks absent offers inactive (§11 step 4) so their reward
    // history keeps pointing somewhere.
    await offer({ networkOfferId: "a", isActive: false });
    expect(await offersFor({ countryCode: "GB" })).toEqual([]);
  });

  it("filters by device when asked", async () => {
    await offer({ networkOfferId: "m", devices: ["android"] });
    await offer({ networkOfferId: "d", devices: ["desktop"] });

    expect(await offersFor({ countryCode: "GB", device: "android" })).toHaveLength(1);
  });

  it("hides a completion rate until there are enough samples", async () => {
    const created = await offer({ networkOfferId: "t" });
    await prisma.offerTier.create({
      data: {
        offerId: created.id,
        sequence: 1,
        label: "Level 5",
        userPays: new Prisma.Decimal("2.0000"),
        starts: 10,
        completions: 5,
      },
    });

    const [row] = await offersFor({ countryCode: "GB" });
    expect(row?.tiers[0]?.completionRate).toBeNull();
    expect(row?.tiers[0]?.unreachable).toBe(false);
  });

  it("marks a well-sampled tier under 5% as unreachable", async () => {
    const created = await offer({ networkOfferId: "t" });
    await prisma.offerTier.create({
      data: {
        offerId: created.id,
        sequence: 1,
        label: "Level 50",
        userPays: new Prisma.Decimal("90.0000"),
        starts: 400,
        completions: 8,
      },
    });

    const [row] = await offersFor({ countryCode: "GB" });
    expect(row?.tiers[0]?.unreachable).toBe(true);
  });

  it("never exposes what the advertiser paid", async () => {
    // §3: advertiserPays is marked "NEVER expose via public API".
    await offer({ networkOfferId: "a" });
    const [row] = await offersFor({ countryCode: "GB" });
    expect(JSON.stringify(row)).not.toContain("advertiserPay");
    expect(JSON.stringify(row)).not.toContain("10.0000");
  });
});

describe("recordStart", () => {
  it("increments every tier of the offer", async () => {
    const created = await offer({ networkOfferId: "t" });
    await prisma.offerTier.createMany({
      data: [
        { offerId: created.id, sequence: 1, label: "A", userPays: new Prisma.Decimal("1") },
        { offerId: created.id, sequence: 2, label: "B", userPays: new Prisma.Decimal("2") },
      ],
    });

    await recordStart(created.id);
    await recordStart(created.id);

    const tiers = await prisma.offerTier.findMany({ where: { offerId: created.id } });
    expect(tiers.map((t) => t.starts)).toEqual([2, 2]);
  });
});
