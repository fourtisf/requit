import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyBinding } from "@/lib/wallet/verify";
import { bindingMessage } from "@/lib/wallet/message";
import { normalizeAddress } from "@/lib/wallet/address";

/**
 * Real keys, real signatures. A mocked verifier would pass whether or not the
 * cryptography is wired up correctly, which is the only thing this file exists
 * to establish.
 */
const EVM_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const evmAccount = privateKeyToAccount(EVM_KEY);

const solanaKeypair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
const solanaAddress = bs58.encode(solanaKeypair.publicKey);

const NONCE = "a".repeat(32);
const ISSUED_AT = "2026-09-11T07:00:00.000Z";

function messageFor(chain: "BASE" | "SOLANA", address: string, nonce = NONCE) {
  return bindingMessage({ chain, address, nonce, issuedAt: ISSUED_AT });
}

async function signEvm(message: string) {
  return evmAccount.signMessage({ message });
}

function signSolana(message: string) {
  const signature = nacl.sign.detached(
    new TextEncoder().encode(message),
    solanaKeypair.secretKey,
  );
  return bs58.encode(signature);
}

describe("Base", () => {
  it("accepts a signature the address really produced", async () => {
    const signature = await signEvm(messageFor("BASE", evmAccount.address));

    await expect(
      verifyBinding({
        chain: "BASE",
        address: evmAccount.address,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      }),
    ).resolves.toBe("ok");
  });

  it("refuses a signature over a different nonce", async () => {
    // The replay case: a signature harvested from an earlier binding attempt.
    const signature = await signEvm(messageFor("BASE", evmAccount.address, "b".repeat(32)));

    await expect(
      verifyBinding({
        chain: "BASE",
        address: evmAccount.address,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      }),
    ).resolves.toBe("bad-signature");
  });

  it("refuses a valid signature presented for someone else's address", async () => {
    const signature = await signEvm(messageFor("BASE", evmAccount.address));
    const other = privateKeyToAccount(
      "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    );

    await expect(
      verifyBinding({
        chain: "BASE",
        address: other.address,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      }),
    ).resolves.toBe("bad-signature");
  });

  it("refuses a garbage signature without throwing", async () => {
    for (const signature of ["", "0x", "not-hex", `0x${"ff".repeat(64)}`]) {
      const outcome = await verifyBinding({
        chain: "BASE",
        address: evmAccount.address,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      });
      expect(outcome, signature).not.toBe("ok");
    }
  });
});

describe("Solana", () => {
  it("accepts a signature the address really produced", async () => {
    const signature = signSolana(messageFor("SOLANA", solanaAddress));

    await expect(
      verifyBinding({
        chain: "SOLANA",
        address: solanaAddress,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      }),
    ).resolves.toBe("ok");
  });

  it("refuses a signature over a different nonce", async () => {
    const signature = signSolana(messageFor("SOLANA", solanaAddress, "c".repeat(32)));

    await expect(
      verifyBinding({
        chain: "SOLANA",
        address: solanaAddress,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      }),
    ).resolves.toBe("bad-signature");
  });

  it("refuses a signature from another keypair", async () => {
    const other = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(9));
    const message = messageFor("SOLANA", solanaAddress);
    const signature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(message), other.secretKey),
    );

    await expect(
      verifyBinding({
        chain: "SOLANA",
        address: solanaAddress,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      }),
    ).resolves.toBe("bad-signature");
  });

  it("refuses garbage without throwing", async () => {
    for (const signature of ["", "!!!!", bs58.encode(new Uint8Array(63))]) {
      const outcome = await verifyBinding({
        chain: "SOLANA",
        address: solanaAddress,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      });
      expect(outcome, signature).not.toBe("ok");
    }
  });
});

describe("a signature for one chain cannot be replayed on the other", () => {
  it("does not accept the Base message signed by a Solana key", async () => {
    // The two messages differ in their chain line, so the bytes never match.
    const baseMessage = messageFor("BASE", solanaAddress);
    const signature = bs58.encode(
      nacl.sign.detached(new TextEncoder().encode(baseMessage), solanaKeypair.secretKey),
    );

    await expect(
      verifyBinding({
        chain: "SOLANA",
        address: solanaAddress,
        nonce: NONCE,
        issuedAt: ISSUED_AT,
        signature,
      }),
    ).resolves.toBe("bad-signature");
  });
});

describe("address normalisation", () => {
  it("gives one spelling for an EVM address whatever case it arrives in", () => {
    const lower = evmAccount.address.toLowerCase();
    const upper = `0x${evmAccount.address.slice(2).toUpperCase()}`;

    const a = normalizeAddress("BASE", lower);
    const b = normalizeAddress("BASE", upper);
    const c = normalizeAddress("BASE", evmAccount.address);

    expect(a).toEqual(b);
    expect(b).toEqual(c);
    // Deterministic output is what makes @@unique([chain, address]) a real
    // guard rather than a formality.
    expect(a).toEqual({ address: evmAccount.address });
  });

  it("refuses addresses that are not addresses", () => {
    for (const bad of ["", "0x", "0xzz", evmAccount.address.slice(0, -1), "not an address"]) {
      expect(normalizeAddress("BASE", bad), bad).toEqual({ problem: "malformed" });
    }
  });

  it("accepts a Solana address and refuses wrong-length base58", () => {
    expect(normalizeAddress("SOLANA", solanaAddress)).toEqual({ address: solanaAddress });
    expect(normalizeAddress("SOLANA", bs58.encode(new Uint8Array(31)))).toEqual({
      problem: "malformed",
    });
    expect(normalizeAddress("SOLANA", "0O1lI")).toEqual({ problem: "malformed" });
  });
});
