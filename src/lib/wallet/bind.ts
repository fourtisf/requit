import { Prisma, type Chain, type Wallet } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/wallet/address";
import { bindingMessage } from "@/lib/wallet/message";
import { consumeNonce, issueNonce } from "@/lib/wallet/nonce";
import { verifyBinding } from "@/lib/wallet/verify";

export const MAX_WALLETS_PER_CHAIN = 3;

export type BeginFailure =
  | "malformed-address"
  | "address-taken"
  | "too-many-wallets";

export type BeginResult =
  | { ok: true; nonce: string; message: string; address: string }
  | { ok: false; reason: BeginFailure };

/**
 * Step one: hand back the exact text to sign.
 *
 * No Wallet row is written here, and that is deliberate. Creating an unverified
 * row at this point would let anyone reserve any address — the unique
 * constraint would then lock the real owner out of their own wallet, for free,
 * with no signature required. The row appears only once ownership is proven.
 */
export async function beginBinding(input: {
  userId: string;
  chain: Chain;
  address: string;
}): Promise<BeginResult> {
  const normalized = normalizeAddress(input.chain, input.address);
  if ("problem" in normalized) return { ok: false, reason: "malformed-address" };

  const existing = await prisma.wallet.findUnique({
    where: { chain_address: { chain: input.chain, address: normalized.address } },
    select: { userId: true },
  });
  // Re-binding an address you already own is allowed — it is how someone
  // re-verifies after changing wallet software. Someone else's is not.
  if (existing && existing.userId !== input.userId) {
    return { ok: false, reason: "address-taken" };
  }

  if (!existing) {
    const count = await prisma.wallet.count({
      where: { userId: input.userId, chain: input.chain },
    });
    if (count >= MAX_WALLETS_PER_CHAIN) return { ok: false, reason: "too-many-wallets" };
  }

  const { nonce, record } = await issueNonce({
    userId: input.userId,
    chain: input.chain,
    address: normalized.address,
  });

  return {
    ok: true,
    nonce,
    address: normalized.address,
    message: bindingMessage({
      chain: input.chain,
      address: normalized.address,
      nonce,
      issuedAt: record.issuedAt,
    }),
  };
}

export type CompleteFailure =
  | "unknown-or-used-nonce"
  | "wrong-session"
  | "bad-signature"
  | "address-taken";

export type CompleteResult = { ok: true; wallet: Wallet } | { ok: false; reason: CompleteFailure };

/**
 * Step two: check the signature and write the row.
 *
 * The nonce is consumed before the signature is checked. A nonce that survives
 * a failed attempt is a nonce an attacker can keep grinding against; burning it
 * on first presentation costs a legitimate user one extra click and costs an
 * attacker the whole approach.
 */
export async function completeBinding(input: {
  userId: string;
  nonce: string;
  signature: string;
}): Promise<CompleteResult> {
  const record = await consumeNonce(input.nonce);
  if (!record) return { ok: false, reason: "unknown-or-used-nonce" };

  // The nonce was issued to one session. Redeeming it from another is either a
  // stolen nonce or a confused client; neither should bind a wallet.
  if (record.userId !== input.userId) return { ok: false, reason: "wrong-session" };

  const outcome = await verifyBinding({
    chain: record.chain,
    address: record.address,
    nonce: input.nonce,
    issuedAt: record.issuedAt,
    signature: input.signature,
  });
  if (outcome !== "ok") return { ok: false, reason: "bad-signature" };

  // First verified wallet on a chain becomes the default destination, so the
  // common case needs no second decision.
  const hasPayout = await prisma.wallet.findFirst({
    where: { userId: input.userId, chain: record.chain, isPayout: true },
    select: { id: true },
  });

  try {
    const wallet = await prisma.wallet.upsert({
      where: { chain_address: { chain: record.chain, address: record.address } },
      create: {
        userId: input.userId,
        chain: record.chain,
        address: record.address,
        verifiedAt: new Date(),
        isPayout: hasPayout === null,
      },
      update: { verifiedAt: new Date() },
    });

    // The upsert's update branch would happily re-verify a row owned by someone
    // else if one appeared between the check above and here. Refuse rather than
    // hand over another account's wallet.
    if (wallet.userId !== input.userId) return { ok: false, reason: "address-taken" };

    return { ok: true, wallet };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // §5: a clear error, not a 500.
      return { ok: false, reason: "address-taken" };
    }
    throw error;
  }
}

/** Makes one wallet the default destination for its chain. */
export async function setPayoutWallet(userId: string, walletId: string): Promise<boolean> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { userId: true, chain: true, verifiedAt: true },
  });
  if (!wallet || wallet.userId !== userId || wallet.verifiedAt === null) return false;

  await prisma.$transaction([
    prisma.wallet.updateMany({
      where: { userId, chain: wallet.chain },
      data: { isPayout: false },
    }),
    prisma.wallet.update({ where: { id: walletId }, data: { isPayout: true } }),
  ]);
  return true;
}
