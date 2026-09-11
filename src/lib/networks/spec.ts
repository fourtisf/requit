import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Network } from "@prisma/client";

/**
 * How each offer network signs its postbacks.
 *
 * HANDOFF.md §4.2 is explicit: "DO NOT guess the formula. Read the current
 * integration doc in each network's publisher dashboard and implement exactly
 * what it specifies."
 *
 * So the mechanism is written here and the *fact* is not. Each spec carries
 * `confirmed`, which stays false until a person has checked it against that
 * network's own documentation. An unconfirmed spec refuses every postback
 * rather than accepting one it cannot actually verify — a signature check that
 * passes on a formula nobody validated is worse than none, because it looks
 * like security.
 */
export type SignatureSpec = {
  /** Digest the network uses. */
  algorithm: "md5" | "hmac-sha256";
  /**
   * Parameter names concatenated in this exact order before hashing. The secret
   * is appended for `md5` and used as the key for `hmac-sha256`.
   */
  fields: readonly string[];
  /** Query parameter carrying the signature the network computed. */
  signatureParam: string;
  /**
   * Flip to true only after checking this against the network's publisher
   * dashboard, and test with their sandbox postback tool before going live.
   */
  confirmed: boolean;
};

/**
 * Placeholders in the shape each network is known to use, none verified.
 * Confirming one is a two-line change: fix the field order, set confirmed.
 */
export const SIGNATURE_SPECS: Record<Network, SignatureSpec> = {
  CPX: {
    algorithm: "md5",
    fields: ["trans_id", "user_id", "amount_local"],
    signatureParam: "hash",
    confirmed: false,
  },
  LOOTABLY: {
    algorithm: "hmac-sha256",
    fields: ["userID", "transactionID", "revenue"],
    signatureParam: "hash",
    confirmed: false,
  },
  TIMEWALL: {
    algorithm: "hmac-sha256",
    fields: ["userID", "transactionID", "currencyAmount"],
    signatureParam: "hash",
    confirmed: false,
  },
  TOROX: {
    algorithm: "md5",
    fields: ["oid", "user_id", "payout"],
    signatureParam: "sig",
    confirmed: false,
  },
};

export class SignatureSpecUnconfirmedError extends Error {
  override name = "SignatureSpecUnconfirmedError";

  constructor(network: Network) {
    super(
      `The signature spec for ${network} has not been checked against their publisher ` +
        `documentation. Confirm it in src/lib/networks/spec.ts before accepting postbacks.`,
    );
  }
}

export type VerifyResult = "ok" | "bad-signature" | "missing-signature" | "unconfirmed-spec";

export function verifySignature(
  network: Network,
  params: Record<string, string>,
  secret: string,
  spec: SignatureSpec = SIGNATURE_SPECS[network],
): VerifyResult {
  if (!spec.confirmed) return "unconfirmed-spec";

  const provided = params[spec.signatureParam];
  if (!provided) return "missing-signature";

  const payload = spec.fields.map((field) => params[field] ?? "").join("");
  const expected =
    spec.algorithm === "md5"
      ? createHash("md5").update(`${payload}${secret}`).digest("hex")
      : createHmac("sha256", secret).update(payload).digest("hex");

  return constantTimeEquals(provided, expected) ? "ok" : "bad-signature";
}

/**
 * Comparing with === leaks how much of the signature matched through timing.
 * The length check before it is safe to short-circuit: length is not secret.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a.toLowerCase());
  const right = Buffer.from(b.toLowerCase());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
