import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction as referenceCreate,
  createTransferCheckedInstruction as referenceTransfer,
} from "@solana/spl-token";
import {
  associatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  transferCheckedInstruction,
  toBaseUnits,
  USDC_DECIMALS,
  USDC_MINT_MAINNET,
} from "@/lib/payout/spl";

/**
 * Differential tests against @solana/spl-token.
 *
 * That package is a devDependency and is imported here only. It pulls
 * bigint-buffer, which carries a high-severity overflow reachable from RPC
 * data, so it must not be in the runtime path — but it is the canonical
 * implementation, which makes it exactly the right thing to check our own
 * instructions against. "Hand-rolled" is only acceptable if it is provably
 * identical to the reference.
 */

const mint = new PublicKey(USDC_MINT_MAINNET);
const owner = Keypair.fromSeed(new Uint8Array(32).fill(3)).publicKey;
const payer = Keypair.fromSeed(new Uint8Array(32).fill(4)).publicKey;

describe("associated token address", () => {
  it("matches the reference implementation", () => {
    expect(associatedTokenAddress(owner, mint).toBase58()).toBe(
      getAssociatedTokenAddressSync(mint, owner).toBase58(),
    );
  });

  it("matches for many different owners", () => {
    // Seed order is the failure mode: a wrong order still derives a valid
    // address, and a transfer to it would succeed on chain while delivering
    // nothing. One matching case could be luck; twenty cannot.
    for (let seed = 0; seed < 20; seed += 1) {
      const someone = Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey;
      expect(associatedTokenAddress(someone, mint).toBase58(), `seed ${seed}`).toBe(
        getAssociatedTokenAddressSync(mint, someone).toBase58(),
      );
    }
  });

  it("gives a different account per owner and per mint", () => {
    const otherOwner = Keypair.fromSeed(new Uint8Array(32).fill(5)).publicKey;
    const otherMint = Keypair.fromSeed(new Uint8Array(32).fill(6)).publicKey;

    expect(associatedTokenAddress(owner, mint).toBase58()).not.toBe(
      associatedTokenAddress(otherOwner, mint).toBase58(),
    );
    expect(associatedTokenAddress(owner, mint).toBase58()).not.toBe(
      associatedTokenAddress(owner, otherMint).toBase58(),
    );
  });
});

describe("create-ATA instruction", () => {
  it("matches the reference byte for byte", () => {
    const ours = createAssociatedTokenAccountIdempotentInstruction({ payer, owner, mint });
    const theirs = referenceCreate(payer, associatedTokenAddress(owner, mint), owner, mint);

    expect(ours.programId.toBase58()).toBe(theirs.programId.toBase58());
    expect(ours.data).toEqual(theirs.data);
    expect(ours.keys.map(describeKey)).toEqual(theirs.keys.map(describeKey));
  });
});

describe("transfer-checked instruction", () => {
  const source = associatedTokenAddress(payer, mint);
  const destination = associatedTokenAddress(owner, mint);

  it("matches the reference byte for byte", () => {
    const ours = transferCheckedInstruction({
      source,
      mint,
      destination,
      owner: payer,
      amount: 12_500_000n,
      decimals: USDC_DECIMALS,
    });
    const theirs = referenceTransfer(
      source,
      mint,
      destination,
      payer,
      12_500_000n,
      USDC_DECIMALS,
    );

    expect(ours.programId.toBase58()).toBe(theirs.programId.toBase58());
    expect(ours.data).toEqual(theirs.data);
    expect(ours.keys.map(describeKey)).toEqual(theirs.keys.map(describeKey));
  });

  it("matches across the whole u64 range", () => {
    for (const amount of [1n, 999_999n, 1_000_000n, 2n ** 32n, 2n ** 53n + 1n, 2n ** 64n - 1n]) {
      const ours = transferCheckedInstruction({
        source,
        mint,
        destination,
        owner: payer,
        amount,
        decimals: USDC_DECIMALS,
      });
      const theirs = referenceTransfer(source, mint, destination, payer, amount, USDC_DECIMALS);
      expect(ours.data, amount.toString()).toEqual(theirs.data);
    }
  });

  it("refuses amounts it cannot encode", () => {
    const build = (amount: bigint, decimals = USDC_DECIMALS) =>
      transferCheckedInstruction({ source, mint, destination, owner: payer, amount, decimals });

    expect(() => build(0n)).toThrow();
    expect(() => build(-1n)).toThrow();
    expect(() => build(2n ** 64n)).toThrow();
    expect(() => build(1n, 10)).toThrow();
  });
});

describe("USD to base units", () => {
  it("converts exactly, without a float in the middle", () => {
    expect(toBaseUnits("10", 6)).toBe(10_000_000n);
    expect(toBaseUnits("10.50", 6)).toBe(10_500_000n);
    expect(toBaseUnits("0.000001", 6)).toBe(1n);
    // 0.07 * 1e6 is 70000.00000000001 in binary floating point. Doing this on
    // the digits is the only way it comes out right for every amount.
    expect(toBaseUnits("0.07", 6)).toBe(70_000n);
    expect(toBaseUnits("1234567.891234", 6)).toBe(1_234_567_891_234n);
  });

  it("refuses precision it would have to throw away", () => {
    // Truncating here would short the member a fraction of a cent every time,
    // which only becomes visible in aggregate.
    expect(() => toBaseUnits("1.0000001", 6)).toThrow();
  });

  it("refuses anything that is not a plain decimal", () => {
    for (const bad of ["", "-1", "1e6", "1,000", "abc", "1.2.3", " 1 "]) {
      expect(() => toBaseUnits(bad, 6), bad).toThrow();
    }
  });
});

function describeKey(key: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }) {
  return { key: key.pubkey.toBase58(), signer: key.isSigner, writable: key.isWritable };
}
