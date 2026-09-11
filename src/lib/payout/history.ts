import { createPublicClient, http, formatEther, type Hex } from "viem";
import { base } from "viem/chains";
import { Connection, PublicKey, type ConfirmedSignatureInfo } from "@solana/web3.js";
import bs58 from "bs58";
import { Prisma } from "@prisma/client";
import type { HistorySource, OutboundTransfer } from "@/lib/payout/reconcile";
import { associatedTokenAddress, USDC_DECIMALS, USDC_MINT_MAINNET } from "@/lib/payout/spl";

/**
 * Reads back what the hot wallet actually sent.
 *
 * This is the other half of reconcile(): the database says what we meant to
 * send, and these say what left. When they disagree, the chain is right.
 */

/** Roughly 48 hours of Base blocks at two seconds each, with headroom. */
const BASE_LOOKBACK_BLOCKS = 100_000n;

export function baseHistory(options: {
  rpcUrl: string;
  hotAddress: string;
  /** USD per ETH at reconciliation time. Passed in so the caller controls it. */
  ethUsd: () => Promise<number>;
}): HistorySource {
  const client = createPublicClient({ chain: base, transport: http(options.rpcUrl) });

  return {
    chain: "BASE",

    async recentOutbound(since) {
      const head = await client.getBlockNumber();
      const from = head > BASE_LOOKBACK_BLOCKS ? head - BASE_LOOKBACK_BLOCKS : 0n;
      const price = new Prisma.Decimal(await options.ethUsd());
      const transfers: OutboundTransfer[] = [];

      // Plain ETH transfers emit no log, so they cannot be found with a filter
      // — the blocks have to be read. Kept to a bounded window for that reason.
      for (let number = from; number <= head; number += 1n) {
        const block = await client.getBlock({ blockNumber: number, includeTransactions: true });
        const at = new Date(Number(block.timestamp) * 1000);
        if (at < since) continue;

        for (const transaction of block.transactions) {
          if (typeof transaction === "string") continue;
          if (transaction.from.toLowerCase() !== options.hotAddress.toLowerCase()) continue;
          if (!transaction.to || transaction.value === 0n) continue;

          transfers.push({
            txHash: transaction.hash,
            to: transaction.to,
            amountUsd: new Prisma.Decimal(formatEther(transaction.value)).mul(price).toFixed(2),
            at,
          });
        }
      }

      return transfers;
    },
  };
}

export function solanaHistory(options: {
  rpcUrl: string;
  hotAddress: string;
  mint?: string;
}): HistorySource {
  const connection = new Connection(options.rpcUrl, "confirmed");
  const mint = new PublicKey(options.mint ?? USDC_MINT_MAINNET);
  const source = associatedTokenAddress(new PublicKey(options.hotAddress), mint);

  return {
    chain: "SOLANA",

    async recentOutbound(since) {
      const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
        source,
        { limit: 1000 },
      );
      const transfers: OutboundTransfer[] = [];

      for (const signature of signatures) {
        if (signature.err) continue;
        const at = signature.blockTime ? new Date(signature.blockTime * 1000) : null;
        if (!at || at < since) continue;

        const parsed = await connection.getParsedTransaction(signature.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!parsed?.meta || parsed.meta.err) continue;

        // Read the balance deltas rather than decoding instructions: the
        // difference in the recipient's token account is what actually arrived,
        // which is the number reconciliation has to match.
        const before = new Map(
          (parsed.meta.preTokenBalances ?? []).map((entry) => [entry.accountIndex, entry]),
        );

        for (const after of parsed.meta.postTokenBalances ?? []) {
          if (after.mint !== mint.toBase58()) continue;
          if (!after.owner || after.owner === options.hotAddress) continue;

          const priorRaw = before.get(after.accountIndex)?.uiTokenAmount.amount ?? "0";
          const delta = BigInt(after.uiTokenAmount.amount) - BigInt(priorRaw);
          if (delta <= 0n) continue;

          transfers.push({
            txHash: signature.signature,
            to: after.owner,
            amountUsd: new Prisma.Decimal(delta.toString())
              .div(new Prisma.Decimal(10).pow(USDC_DECIMALS))
              .toFixed(2),
            at,
          });
        }
      }

      return transfers;
    },
  };
}

/** Validates a base58 secret key without building a signer from it. */
export function looksLikeSolanaSecret(value: string): boolean {
  try {
    return bs58.decode(value).length === 64;
  } catch {
    return false;
  }
}

/** Validates a hex private key without building a signer from it. */
export function looksLikeEvmSecret(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
