import { getAddress, isAddress } from "viem";
import bs58 from "bs58";
import type { Chain } from "@prisma/client";

/**
 * One canonical spelling per address, because `@@unique([chain, address])` is
 * the anti-multi-account guard and a constraint only holds over bytes that
 * match. If one path stored `0xAb…` and another `0xab…`, the same wallet would
 * bind to two accounts and the guard would be decorative.
 *
 * Normalisation lives here alone. Nothing else may write Wallet.address.
 */
export type AddressProblem = "malformed" | "not-a-signing-address";

export type NormalizedAddress = { address: string } | { problem: AddressProblem };

const SOLANA_KEY_BYTES = 32;

export function normalizeAddress(chain: Chain, raw: string): NormalizedAddress {
  const input = raw.trim();
  if (input === "") return { problem: "malformed" };

  if (chain === "BASE") {
    // isAddress rejects length and hex errors; getAddress then produces the
    // EIP-55 checksummed form, which is deterministic — the same input always
    // yields the same bytes, so the unique constraint holds.
    if (!isAddress(input, { strict: false })) return { problem: "malformed" };
    return { address: getAddress(input) };
  }

  let decoded: Uint8Array;
  try {
    decoded = bs58.decode(input);
  } catch {
    return { problem: "malformed" };
  }
  if (decoded.length !== SOLANA_KEY_BYTES) return { problem: "malformed" };

  // Base58 has no case folding and no alternative encodings for the same
  // bytes, so the input is already canonical. Re-encoding the decoded bytes
  // would be a no-op that only hides a decode bug.
  return { address: input };
}

/** Display form: enough to recognise, short enough not to wrap. */
export function shortAddress(address: string): string {
  return address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
