import type { Chain } from "@prisma/client";
import { BRAND } from "@/lib/brand";

/** Base mainnet. Pinned so a signature for another chain cannot be replayed here. */
export const BASE_CHAIN_ID = 8453;

export type BindingRequest = {
  chain: Chain;
  address: string;
  nonce: string;
  issuedAt: string;
};

/**
 * The exact bytes the wallet is asked to sign.
 *
 * EVM follows EIP-4361 so that every wallet renders it as a recognised sign-in
 * rather than as opaque hex — a user who cannot read what they are signing
 * learns to sign anything, which is the habit that drains wallets.
 *
 * Solana has no equivalent standard, so it gets the same fields in the same
 * order. The value is that both say, in the first line a person reads, what
 * this signature does and what it does not.
 *
 * Built identically on the client and the server: the server never trusts a
 * client-supplied message, it rebuilds it from the stored nonce and compares
 * the signature against its own bytes.
 */
export function bindingMessage(request: BindingRequest): string {
  const { chain, address, nonce, issuedAt } = request;

  const purpose = [
    "",
    `Bind this wallet to your ${BRAND.name} account.`,
    "",
    "Signing is free. It does not move funds, does not approve any",
    "transaction, and gives no permission to spend.",
    "",
  ];

  if (chain === "BASE") {
    return [
      `${BRAND.domain} wants you to sign in with your Ethereum account:`,
      address,
      ...purpose,
      `URI: https://${BRAND.domain}`,
      "Version: 1",
      `Chain ID: ${BASE_CHAIN_ID}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ].join("\n");
  }

  return [
    `${BRAND.domain} wants you to sign in with your Solana account:`,
    address,
    ...purpose,
    `URI: https://${BRAND.domain}`,
    "Version: 1",
    "Chain: solana:mainnet",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}
