import { beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { beginBinding, completeBinding, MAX_WALLETS_PER_CHAIN, setPayoutWallet } from "@/lib/wallet/bind";
import { makeUser, prisma, resetDatabase } from "@/test/db";

const account = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);
const other = privateKeyToAccount(
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
);

beforeEach(async () => {
  await resetDatabase();
});

async function member(email = "ada@example.com", handle = "ada") {
  return makeUser({ email, handle });
}

/** Walks the whole flow the way the browser does. */
async function bind(userId: string, signer = account, address = signer.address) {
  const begin = await beginBinding({ userId, chain: "BASE", address });
  if (!begin.ok) return { begin, complete: null };

  const signature = await signer.signMessage({ message: begin.message });
  const complete = await completeBinding({ userId, nonce: begin.nonce, signature });
  return { begin, complete };
}

describe("binding a wallet", () => {
  it("writes the row only once ownership is proven", async () => {
    const user = await member();

    const begin = await beginBinding({
      userId: user.id,
      chain: "BASE",
      address: account.address,
    });
    expect(begin.ok).toBe(true);

    // Nothing exists yet. If a row were created here, anyone could reserve any
    // address and the unique constraint would lock the real owner out.
    expect(await prisma.wallet.count()).toBe(0);

    if (!begin.ok) return;
    const signature = await account.signMessage({ message: begin.message });
    const complete = await completeBinding({
      userId: user.id,
      nonce: begin.nonce,
      signature,
    });

    expect(complete.ok).toBe(true);
    if (!complete.ok) return;
    expect(complete.wallet.verifiedAt).toBeInstanceOf(Date);
    expect(complete.wallet.address).toBe(account.address);
    // First wallet on a chain becomes the default, so there is no second step.
    expect(complete.wallet.isPayout).toBe(true);
  });

  it("stores the checksummed address whatever case was typed", async () => {
    const user = await member();
    const { complete } = await bind(user.id, account, account.address.toLowerCase());

    expect(complete?.ok).toBe(true);
    const stored = await prisma.wallet.findFirstOrThrow();
    expect(stored.address).toBe(account.address);
  });
});

describe("replay", () => {
  it("refuses a nonce that was already used", async () => {
    const user = await member();
    const begin = await beginBinding({
      userId: user.id,
      chain: "BASE",
      address: account.address,
    });
    if (!begin.ok) throw new Error("setup failed");

    const signature = await account.signMessage({ message: begin.message });
    const first = await completeBinding({ userId: user.id, nonce: begin.nonce, signature });
    const second = await completeBinding({ userId: user.id, nonce: begin.nonce, signature });

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, reason: "unknown-or-used-nonce" });
  });

  it("burns the nonce even when the signature was wrong", async () => {
    // A nonce that survives a failure is one an attacker can grind against.
    const user = await member();
    const begin = await beginBinding({
      userId: user.id,
      chain: "BASE",
      address: account.address,
    });
    if (!begin.ok) throw new Error("setup failed");

    const wrong = await other.signMessage({ message: begin.message });
    const failed = await completeBinding({ userId: user.id, nonce: begin.nonce, signature: wrong });
    expect(failed).toEqual({ ok: false, reason: "bad-signature" });

    const right = await account.signMessage({ message: begin.message });
    const retry = await completeBinding({ userId: user.id, nonce: begin.nonce, signature: right });
    expect(retry).toEqual({ ok: false, reason: "unknown-or-used-nonce" });
  });

  it("refuses a nonce redeemed from another session", async () => {
    const owner = await member();
    const stranger = await makeUser({ email: "bob@example.com", handle: "bob" });

    const begin = await beginBinding({
      userId: owner.id,
      chain: "BASE",
      address: account.address,
    });
    if (!begin.ok) throw new Error("setup failed");

    const signature = await account.signMessage({ message: begin.message });
    const result = await completeBinding({ userId: stranger.id, nonce: begin.nonce, signature });

    expect(result).toEqual({ ok: false, reason: "wrong-session" });
    expect(await prisma.wallet.count()).toBe(0);
  });
});

describe("one wallet, one account", () => {
  it("refuses an address already bound elsewhere, with a reason rather than a crash", async () => {
    const owner = await member();
    const stranger = await makeUser({ email: "bob@example.com", handle: "bob" });

    await bind(owner.id);

    // §5: "Return a clear error, not a 500."
    const begin = await beginBinding({
      userId: stranger.id,
      chain: "BASE",
      address: account.address,
    });
    expect(begin).toEqual({ ok: false, reason: "address-taken" });
  });

  it("lets the owner re-verify their own address", async () => {
    const user = await member();
    await bind(user.id);
    const again = await bind(user.id);

    expect(again.complete?.ok).toBe(true);
    expect(await prisma.wallet.count()).toBe(1);
  });

  it("caps how many wallets one account can hold on a chain", async () => {
    const user = await member();

    for (let index = 0; index < MAX_WALLETS_PER_CHAIN; index += 1) {
      await prisma.wallet.create({
        data: {
          userId: user.id,
          chain: "BASE",
          address: `0x${String(index).padStart(40, "0")}`,
          verifiedAt: new Date(),
        },
      });
    }

    const begin = await beginBinding({
      userId: user.id,
      chain: "BASE",
      address: account.address,
    });
    expect(begin).toEqual({ ok: false, reason: "too-many-wallets" });
  });
});

describe("malformed input", () => {
  it("refuses an address that is not one", async () => {
    const user = await member();
    for (const address of ["", "0x", "not-an-address", account.address.slice(0, -1)]) {
      const begin = await beginBinding({ userId: user.id, chain: "BASE", address });
      expect(begin, address).toEqual({ ok: false, reason: "malformed-address" });
    }
  });

  it("refuses an unknown nonce without touching the database", async () => {
    const user = await member();
    const result = await completeBinding({
      userId: user.id,
      nonce: "f".repeat(32),
      signature: "0x00",
    });
    expect(result).toEqual({ ok: false, reason: "unknown-or-used-nonce" });
  });
});

describe("the default destination", () => {
  it("moves to whichever wallet was chosen, leaving exactly one", async () => {
    const user = await member();
    await bind(user.id);
    const second = await prisma.wallet.create({
      data: {
        userId: user.id,
        chain: "BASE",
        address: `0x${"a".repeat(40)}`,
        verifiedAt: new Date(),
      },
    });

    expect(await setPayoutWallet(user.id, second.id)).toBe(true);

    const wallets = await prisma.wallet.findMany({ where: { userId: user.id } });
    expect(wallets.filter((wallet) => wallet.isPayout).map((wallet) => wallet.id)).toEqual([
      second.id,
    ]);
  });

  it("refuses to point payouts at someone else's wallet or an unverified one", async () => {
    const user = await member();
    const stranger = await makeUser({ email: "bob@example.com", handle: "bob" });
    const theirs = await prisma.wallet.create({
      data: {
        userId: stranger.id,
        chain: "BASE",
        address: `0x${"b".repeat(40)}`,
        verifiedAt: new Date(),
      },
    });
    const unverified = await prisma.wallet.create({
      data: { userId: user.id, chain: "BASE", address: `0x${"c".repeat(40)}` },
    });

    expect(await setPayoutWallet(user.id, theirs.id)).toBe(false);
    expect(await setPayoutWallet(user.id, unverified.id)).toBe(false);
  });
});
