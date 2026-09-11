import { isAddress } from "viem";

/**
 * Outbound identity: the token contract, and the two accounts we tell people to
 * trust.
 *
 * Deliberately in code rather than in an environment variable. Both halves of
 * this file are things a typo turns into someone else's money:
 *
 *   - A wrong contract address sends people to buy a different token, and they
 *     do not get it back. An env var is set by whoever last edited a file on
 *     the server at 2am; a constant here goes through a diff.
 *   - A wrong social handle sends people to an impersonator. Every scam in this
 *     category starts with a link on a real site pointing at a fake account.
 *
 * So: null until someone has checked the value, and nothing renders while it is
 * null. An absent link is a non-event. A wrong one is the incident.
 */

export type TokenChain = "BASE" | "SOLANA";

export type TokenInfo = {
  /** null until the contract is live and the address has been verified. */
  address: string | null;
  chain: TokenChain;
};

/**
 * The contract address.
 *
 * Still null, and flipping it is a deliberate act with a diff — social.test.ts
 * asserts it, the same way the network signature specs are asserted unconfirmed.
 * When it is set, validateToken() below refuses anything that is not a
 * well-formed address on the stated chain, so a truncated paste fails the build
 * rather than reaching the page.
 */
export const TOKEN: TokenInfo = {
  address: null,
  chain: "BASE",
};

export type SocialLink = {
  key: "x" | "telegram";
  label: string;
  /** null until the real handle is confirmed. Nothing renders while null. */
  url: string | null;
  handle: string | null;
};

export const SOCIALS: SocialLink[] = [
  { key: "x", label: "X", url: null, handle: null },
  { key: "telegram", label: "Telegram", url: null, handle: null },
];

/** Only the accounts that have a confirmed URL. The return type keeps the
 *  narrowing, so a caller cannot render a null href. */
export type LiveSocial = SocialLink & { url: string };

export function liveSocials(): LiveSocial[] {
  return SOCIALS.filter((social): social is LiveSocial => social.url !== null);
}

/** The accounts we have not opened yet. */
export type PendingSocial = SocialLink & { url: null };

/**
 * Named and shown, but never linked.
 *
 * Silence about an account we have not opened is worse than saying so: it
 * leaves nothing to check an impersonator against. "We have no X account yet"
 * is a claim someone can hold up against the account messaging them. The type
 * pins url to null, so a caller cannot accidentally build an href out of one.
 */
export function pendingSocials(): PendingSocial[] {
  return SOCIALS.filter((social): social is PendingSocial => social.url === null);
}

export type TokenProblem = "malformed-address" | "wrong-chain-format";

/**
 * Checks the address is real for its chain. Called by the test, so a bad value
 * cannot be merged.
 */
export function validateToken(token: TokenInfo): TokenProblem | null {
  if (token.address === null) return null;

  if (token.chain === "BASE") {
    return isAddress(token.address, { strict: false }) ? null : "malformed-address";
  }

  // Solana: base58, 32 bytes, which lands between 32 and 44 characters. Checked
  // on shape here; the full decode lives in lib/wallet/address.ts and is not
  // imported to keep this module free of runtime dependencies.
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token.address) ? null : "malformed-address";
}

/** Where to look the contract up, so the address on the page is checkable. */
export function explorerUrl(token: TokenInfo): string | null {
  if (!token.address) return null;
  return token.chain === "BASE"
    ? `https://basescan.org/token/${token.address}`
    : `https://solscan.io/token/${token.address}`;
}
