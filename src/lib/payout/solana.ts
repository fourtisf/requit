import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  type Commitment,
} from "@solana/web3.js";
import bs58 from "bs58";
import { Prisma } from "@prisma/client";
import type { Sender, TxState } from "@/lib/payout/execute";
import {
  associatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  toBaseUnits,
  transferCheckedInstruction,
  USDC_DECIMALS,
  USDC_MINT_MAINNET,
} from "@/lib/payout/spl";

/**
 * Solana payouts, in USDC. §6.2.
 *
 * USDC is a dollar, so there is no rate to fetch and nothing to get wrong about
 * pricing — the amount owed is the amount sent.
 */

const COMMITMENT: Commitment = "confirmed";

export type SolanaSenderOptions = {
  rpcUrl: string;
  /** base58 secret key, as every Solana wallet exports it. */
  secretKey: string;
  mint?: string;
};

export function createSolanaSender(options: SolanaSenderOptions): Sender {
  const connection = new Connection(options.rpcUrl, COMMITMENT);
  const payer = Keypair.fromSecretKey(bs58.decode(options.secretKey));
  const mint = new PublicKey(options.mint ?? USDC_MINT_MAINNET);
  const source = associatedTokenAddress(payer.publicKey, mint);

  return {
    chain: "SOLANA",

    async send({ to, amountUsd }) {
      const owner = new PublicKey(to);
      const destination = associatedTokenAddress(owner, mint);
      const amount = toBaseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);

      const transaction = new Transaction();

      // §6.2: if the recipient has no USDC account, create it. Rent is about
      // 0.002 SOL and we pay it — a member should not need to already hold USDC
      // to be paid in USDC. The idempotent variant means a race with another
      // creator does not fail the whole payout.
      transaction.add(
        createAssociatedTokenAccountIdempotentInstruction({
          payer: payer.publicKey,
          owner,
          mint,
        }),
      );
      transaction.add(
        transferCheckedInstruction({
          source,
          mint,
          destination,
          owner: payer.publicKey,
          amount,
          decimals: USDC_DECIMALS,
        }),
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(COMMITMENT);
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer);

      // sendRawTransaction, not sendAndConfirm: §6.2 wants the hash persisted
      // before we start waiting, so that a process death during confirmation
      // leaves a row the reconciliation job can match rather than an orphan.
      const txHash = await connection.sendRawTransaction(transaction.serialize(), {
        // The caller is responsible for not sending twice; a preflight retry
        // here could produce a second signature for the same intent.
        maxRetries: 0,
      });
      return { txHash };
    },

    async confirm(txHash): Promise<TxState> {
      const status = await connection.getSignatureStatus(txHash, {
        searchTransactionHistory: true,
      });
      const value = status.value;

      // Null means the cluster has not seen it — still pending, not failed.
      // Calling it failed would reopen the balance while it is live.
      if (!value) return "pending";
      if (value.err) return "failed";

      return value.confirmationStatus === "confirmed" || value.confirmationStatus === "finalized"
        ? "confirmed"
        : "pending";
    },

    async balanceUsd() {
      const balance = await connection.getTokenAccountBalance(source).catch(() => null);
      // A JSON balance from the RPC, not a binary account decode — which is
      // also why @solana/spl-token is not needed at runtime.
      if (!balance?.value.amount) return new Prisma.Decimal(0);

      return new Prisma.Decimal(balance.value.amount).div(
        new Prisma.Decimal(10).pow(balance.value.decimals),
      );
    },
  };
}

/** The hot wallet's own address, for the reconciliation scan. */
export function solanaHotAddress(secretKey: string): string {
  return Keypair.fromSecretKey(bs58.decode(secretKey)).publicKey.toBase58();
}
