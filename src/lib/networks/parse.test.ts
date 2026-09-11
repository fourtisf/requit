import { describe, expect, it } from "vitest";
import { parsePostback } from "@/lib/networks/postback";

const TOROX = { user_id: "u1", oid: "t1", payout: "12.50", revenue: "19.20", status: "1" };

describe("parsePostback", () => {
  it("reads the fields each network actually sends", () => {
    const parsed = parsePostback("TOROX", { ...TOROX, offer_id: "o1", offer_name: "Level 5" });
    expect(parsed).toMatchObject({
      userId: "u1",
      networkTxnId: "t1",
      networkOfferId: "o1",
      tierLabel: "Level 5",
      reversal: false,
    });
  });

  it.each([
    ["missing-user", { ...TOROX, user_id: "" }],
    ["missing-txn", { ...TOROX, oid: "" }],
    ["bad-amount", { ...TOROX, payout: "" }],
    ["bad-amount", { ...TOROX, payout: "not-a-number" }],
  ])("refuses with %s", (reason, params) => {
    expect(parsePostback("TOROX", params)).toBe(reason);
  });

  it("treats the network's reversal status as a reversal", () => {
    const parsed = parsePostback("TOROX", { ...TOROX, status: "2" });
    expect(parsed).toMatchObject({ reversal: true });
  });

  it("treats a negative amount as a reversal, whatever the status says", () => {
    // Some networks signal a chargeback by sign rather than by status. Reading
    // only the status would credit the member a second time for a reversal.
    const parsed = parsePostback("TOROX", { ...TOROX, payout: "-12.50" });
    expect(parsed).toMatchObject({ reversal: true });
    if (typeof parsed === "string") throw new Error("expected a parse");
    expect(parsed.amount.toString()).toBe("12.5");
  });

  it("defaults the advertiser's payment to zero rather than guessing", () => {
    const parsed = parsePostback("TOROX", { ...TOROX, revenue: "" });
    if (typeof parsed === "string") throw new Error("expected a parse");
    expect(parsed.advertiserPaid.toString()).toBe("0");
  });

  it("trims whitespace a network may pad values with", () => {
    const parsed = parsePostback("TOROX", { ...TOROX, user_id: "  u1  ", oid: " t1 " });
    expect(parsed).toMatchObject({ userId: "u1", networkTxnId: "t1" });
  });
});
