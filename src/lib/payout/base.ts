import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { Prisma } from "@prisma/client";
import type { Sender, TxState } from "@/lib/payout/execute";

/**
 * Base payouts, in ETH. §6.2: a plain transfer, one confirmation.
 *
 * Amounts are owed in USD, so a rate is needed, and the handoff does not say
 * where from. This reads Chainlink's ETH/USD feed on Base rather than an HTTP
 * price API: the number that decides how much money leaves should not come from
 * a service that can be down, rate-limited, or man-in-the-middled, and it
 * should be checkable afterwards by anyone with the block number.
 */

/** Chainlink ETH/USD on Base mainnet. Eight decimals. */
export const ETH_USD_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" as const;

const AGGREGATOR_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

/** A price older than this is not a price. The feed updates far more often. */
const MAX_PRICE_AGE_SECONDS = 3600;

/**
 * Sanity bounds, in USD per ETH. Not a market view — a guard against a feed
 * returning something absurd, which is the failure that would send a hundred
 * times the intended amount without anything else noticing.
 */
const MIN_ETH_USD = 100;
const MAX_ETH_USD = 100_000;

export type BaseSenderOptions = {
  rpcUrl: string;
  privateKey: string;
};

export function createBaseSender(options: BaseSenderOptions): Sender {
  const account = privateKeyToAccount(options.privateKey as Hex);
  const transport = http(options.rpcUrl);
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ account, chain: base, transport });

  async function ethUsd(): Promise<number> {
    const [, answer, , updatedAt] = await publicClient.readContract({
      address: ETH_USD_FEED,
      abi: AGGREGATOR_ABI,
      functionName: "latestRoundData",
    });

    if (answer <= 0n) throw new Error("ETH/USD feed returned a non-positive price.");

    const age = Math.floor(Date.now() / 1000) - Number(updatedAt);
    if (age > MAX_PRICE_AGE_SECONDS) {
      throw new Error(`ETH/USD feed is ${age}s stale. Refusing to price a payout from it.`);
    }

    const price = Number(answer) / 1e8;
    if (price < MIN_ETH_USD || price > MAX_ETH_USD) {
      throw new Error(`ETH/USD feed returned ${price}, outside sane bounds. Refusing.`);
    }
    return price;
  }

  /** USD to wei, via a decimal string so no float rounds the amount we send. */
  async function toWei(amountUsd: Prisma.Decimal): Promise<bigint> {
    const price = await ethUsd();
    // Prisma.Decimal keeps this exact; 18 places is wei precision.
    const eth = amountUsd.div(new Prisma.Decimal(price)).toFixed(18, Prisma.Decimal.ROUND_DOWN);
    return parseEther(eth as `${number}`);
  }

  return {
    chain: "BASE",

    async send({ to, amountUsd }) {
      const value = await toWei(amountUsd);
      if (value <= 0n) throw new Error("Computed a zero-value transfer. Refusing.");

      const txHash = await walletClient.sendTransaction({
        to: to as Hex,
        value,
      });
      return { txHash };
    },

    async confirm(txHash): Promise<TxState> {
      const receipt = await publicClient
        .getTransactionReceipt({ hash: txHash as Hex })
        .catch(() => null);

      // No receipt means not mined yet. It does NOT mean failed — treating it
      // as failed would return the amount to a balance while the transaction is
      // still live in the mempool.
      if (!receipt) return "pending";
      if (receipt.status === "reverted") return "failed";

      const confirmations = await publicClient.getBlockNumber().then(
        (head) => head - receipt.blockNumber + 1n,
      );
      return confirmations >= 1n ? "confirmed" : "pending";
    },

    async balanceUsd() {
      const [wei, price] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        ethUsd(),
      ]);
      return new Prisma.Decimal(formatEther(wei)).mul(new Prisma.Decimal(price));
    },
  };
}

/** The hot wallet's own address, for the reconciliation scan. */
export function baseHotAddress(privateKey: string): string {
  return privateKeyToAccount(privateKey as Hex).address;
}
