import { describe, expect, it } from "vitest";
import {
  SOCIALS,
  TOKEN,
  explorerUrl,
  liveSocials,
  pendingSocials,
  validateToken,
  type TokenInfo,
} from "@/lib/social";

describe("the shipped values", () => {
  it("has no contract address yet, so setting one is a deliberate diff", () => {
    // The same guard the network signature specs use. A contract address that
    // could appear by accident is one that could appear wrong, and a wrong one
    // sends people to buy a different token that they do not get back.
    expect(TOKEN.address).toBeNull();
  });

  it("has no social handle yet, so nothing is linked", () => {
    // A link to an account that is not ours is how people get drained by an
    // impersonator. Absent is safe; guessed is not. The chips still render —
    // inert, and saying so — but nothing is clickable until a real handle lands
    // in a diff.
    expect(SOCIALS.every((social) => social.url === null)).toBe(true);
    expect(liveSocials()).toEqual([]);
    expect(pendingSocials()).toHaveLength(SOCIALS.length);
  });

  it("names both accounts, so an impersonator has something to be checked against", () => {
    // The card is only useful if it says which accounts exist. Dropping one
    // leaves the other unclaimed, which is the gap someone registers.
    expect(SOCIALS.map((social) => social.key).sort()).toEqual(["telegram", "x"]);
  });

  it("whatever is shipped is valid for its chain", () => {
    // This is the check that survives the two above being flipped.
    expect(validateToken(TOKEN)).toBeNull();
  });

  it("splits every account into exactly one of linked or pending", () => {
    // A social that fell out of both lists would vanish from the page without
    // anyone noticing it had gone.
    expect(liveSocials().length + pendingSocials().length).toBe(SOCIALS.length);
    for (const social of pendingSocials()) expect(social.url).toBeNull();
  });

  it("ships only https links when it ships any", () => {
    for (const social of SOCIALS) {
      if (social.url === null) continue;
      expect(social.url.startsWith("https://"), social.key).toBe(true);
    }
  });
});

describe("address validation", () => {
  const base = (address: string | null): TokenInfo => ({ address, chain: "BASE" });
  const solana = (address: string | null): TokenInfo => ({ address, chain: "SOLANA" });

  it("accepts a real Base address", () => {
    expect(validateToken(base("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"))).toBeNull();
  });

  it("accepts a real Solana mint", () => {
    expect(validateToken(solana("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"))).toBeNull();
  });

  it("refuses a truncated paste, which is the realistic mistake", () => {
    // Copying from a block explorer and losing the last characters produces
    // something that still looks like an address at a glance.
    expect(validateToken(base("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA029"))).toBe(
      "malformed-address",
    );
    expect(validateToken(solana("EPjFWdd5AufqSSqeM2qN1xzy"))).toBe("malformed-address");
  });

  it("refuses an address pasted for the wrong chain", () => {
    expect(validateToken(base("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"))).toBe(
      "malformed-address",
    );
    expect(validateToken(solana("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"))).toBe(
      "malformed-address",
    );
  });

  it("refuses junk", () => {
    for (const address of ["", "  ", "0x", "coming soon", "TBA", "null"]) {
      expect(validateToken(base(address)), address).not.toBeNull();
    }
  });

  it("passes a null address, because that is the honest state", () => {
    expect(validateToken(base(null))).toBeNull();
  });
});

describe("explorer link", () => {
  it("points at the right chain", () => {
    expect(explorerUrl({ address: "0xabc", chain: "BASE" })).toContain("basescan.org");
    expect(explorerUrl({ address: "abc", chain: "SOLANA" })).toContain("solscan.io");
  });

  it("has nowhere to point while there is no contract", () => {
    expect(explorerUrl({ address: null, chain: "BASE" })).toBeNull();
  });
});
