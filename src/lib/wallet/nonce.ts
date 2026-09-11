import { randomBytes } from "node:crypto";
import type { Chain } from "@prisma/client";
import { kv } from "@/lib/redis";

/** §5: ten minutes. Long enough to open a wallet app, short enough to matter. */
export const NONCE_TTL_SECONDS = 10 * 60;

export type NonceRecord = {
  userId: string;
  chain: Chain;
  address: string;
  issuedAt: string;
};

function key(nonce: string): string {
  return `wallet:nonce:${nonce}`;
}

/**
 * Issues a single-use nonce bound to one session, one chain and one address.
 *
 * Binding all three is what makes the signature non-transferable: a nonce
 * issued to A for address X cannot be redeemed by B, and cannot be redeemed for
 * address Y. Without the binding, a nonce is just a random string that any
 * signature could be paired with.
 */
export async function issueNonce(
  binding: Omit<NonceRecord, "issuedAt">,
): Promise<{ nonce: string; record: NonceRecord }> {
  const nonce = randomBytes(16).toString("hex");
  const record: NonceRecord = { ...binding, issuedAt: new Date().toISOString() };

  await kv().set(key(nonce), JSON.stringify(record), "EX", NONCE_TTL_SECONDS);
  return { nonce, record };
}

/**
 * Reads and destroys the nonce in one round trip.
 *
 * GETDEL is atomic, so two requests racing with the same nonce cannot both
 * succeed — §5's "replay must fail" is enforced by Redis rather than by a
 * read-then-delete that has a window between the two.
 */
export async function consumeNonce(nonce: string): Promise<NonceRecord | null> {
  if (!/^[0-9a-f]{32}$/.test(nonce)) return null;

  const raw = await kv().getdel(key(nonce));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as NonceRecord;
  } catch {
    return null;
  }
}
