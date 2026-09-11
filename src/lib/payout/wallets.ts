import type { Chain } from "@prisma/client";
import type { Sender } from "@/lib/payout/execute";
import type { HistorySource } from "@/lib/payout/reconcile";
import { loadHotWalletSecret } from "@/lib/payout/keystore";
import { createBaseSender, baseHotAddress, ETH_USD_FEED } from "@/lib/payout/base";
import { createSolanaSender, solanaHotAddress } from "@/lib/payout/solana";
import { baseHistory, looksLikeEvmSecret, looksLikeSolanaSecret, solanaHistory } from "@/lib/payout/history";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

/**
 * Builds the chain adapters at worker start, or explains why it cannot.
 *
 * The worker is expected to run with no wallet configured and to keep running:
 * everything else it does — maturing rewards, releasing holds — is unrelated to
 * sending money, and it should not stop because a keystore is missing. What it
 * must never do is silently behave as if payouts are working when they are not,
 * so an unconfigured chain is a stated, visible absence rather than a no-op.
 */

export type WalletSet = {
  senders: Map<Chain, Sender>;
  histories: Map<Chain, HistorySource>;
  /** Why each chain is unavailable, if it is. Reported at boot. */
  unavailable: Map<Chain, string>;
};

type Env = {
  BASE_RPC_URL?: string;
  SOLANA_RPC_URL?: string;
  USDC_MINT?: string;
  HOT_WALLET_KEYSTORE_PATH?: string;
  HOT_WALLET_PASSPHRASE?: string;
  HOT_WALLET_KEYSTORE_PATH_SOLANA?: string;
};

export function loadWallets(env: Env = process.env as Env): WalletSet {
  const senders = new Map<Chain, Sender>();
  const histories = new Map<Chain, HistorySource>();
  const unavailable = new Map<Chain, string>();

  const passphrase = env.HOT_WALLET_PASSPHRASE ?? "";

  // ── Base ────────────────────────────────────────────────────────────────
  const basePath = env.HOT_WALLET_KEYSTORE_PATH ?? "";
  const baseRpc = env.BASE_RPC_URL ?? "";

  if (!basePath || !baseRpc || !passphrase) {
    unavailable.set(
      "BASE",
      !passphrase
        ? "HOT_WALLET_PASSPHRASE is not in the environment"
        : !basePath
          ? "HOT_WALLET_KEYSTORE_PATH is not set"
          : "BASE_RPC_URL is not set",
    );
  } else {
    try {
      const { secret } = loadHotWalletSecret({ keystorePath: basePath, passphrase });
      if (!looksLikeEvmSecret(secret)) {
        throw new Error("The keystore does not hold a 32-byte hex private key.");
      }

      senders.set("BASE", createBaseSender({ rpcUrl: baseRpc, privateKey: secret }));
      histories.set(
        "BASE",
        baseHistory({
          rpcUrl: baseRpc,
          hotAddress: baseHotAddress(secret),
          ethUsd: () => readEthUsd(baseRpc),
        }),
      );
    } catch (error) {
      unavailable.set("BASE", error instanceof Error ? error.message : "unknown error");
    }
  }

  // ── Solana ──────────────────────────────────────────────────────────────
  const solanaPath = env.HOT_WALLET_KEYSTORE_PATH_SOLANA ?? "";
  const solanaRpc = env.SOLANA_RPC_URL ?? "";

  if (!solanaPath || !solanaRpc || !passphrase) {
    unavailable.set(
      "SOLANA",
      !passphrase
        ? "HOT_WALLET_PASSPHRASE is not in the environment"
        : !solanaPath
          ? "HOT_WALLET_KEYSTORE_PATH_SOLANA is not set"
          : "SOLANA_RPC_URL is not set",
    );
  } else {
    try {
      const { secret } = loadHotWalletSecret({ keystorePath: solanaPath, passphrase });
      if (!looksLikeSolanaSecret(secret)) {
        throw new Error("The keystore does not hold a 64-byte base58 secret key.");
      }

      const options = { rpcUrl: solanaRpc, secretKey: secret, ...(env.USDC_MINT ? { mint: env.USDC_MINT } : {}) };
      senders.set("SOLANA", createSolanaSender(options));
      histories.set(
        "SOLANA",
        solanaHistory({
          rpcUrl: solanaRpc,
          hotAddress: solanaHotAddress(secret),
          ...(env.USDC_MINT ? { mint: env.USDC_MINT } : {}),
        }),
      );
    } catch (error) {
      unavailable.set("SOLANA", error instanceof Error ? error.message : "unknown error");
    }
  }

  return { senders, histories, unavailable };
}

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

async function readEthUsd(rpcUrl: string): Promise<number> {
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const [, answer] = await client.readContract({
    address: ETH_USD_FEED,
    abi: AGGREGATOR_ABI,
    functionName: "latestRoundData",
  });
  return Number(answer) / 1e8;
}
