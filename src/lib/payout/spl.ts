import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

/**
 * The two SPL Token instructions a payout needs, built directly.
 *
 * @solana/spl-token was removed because it pulls bigint-buffer, which carries a
 * high-severity buffer overflow in toBigIntLE — reachable from account data our
 * RPC returns, inside the payout path. Both instructions here are small and
 * fully specified, and spl.test.ts checks them against the library's own output
 * so "hand-rolled" does not mean "unverified". The library stays a
 * devDependency for exactly that comparison and is never imported at runtime.
 */

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/** USDC on Solana mainnet-beta. Six decimals. */
export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;

/** TokenInstruction::TransferChecked. */
const TRANSFER_CHECKED = 12;
/** AssociatedTokenAccountInstruction::CreateIdempotent. */
const CREATE_IDEMPOTENT = 1;

/**
 * The associated token account for (owner, mint).
 *
 * Seed order is [owner, token program, mint] and is load-bearing: a different
 * order derives a valid-looking address that holds nothing, so a transfer to it
 * would succeed on chain and deliver nothing to the member.
 */
export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

/**
 * Creates the recipient's token account if it does not exist yet.
 *
 * The idempotent variant, so a race between our own check and the transaction
 * landing does not fail the whole payout — §6.2 budgets the rent for this and
 * we pay it.
 */
export function createAssociatedTokenAccountIdempotentInstruction(args: {
  payer: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
}): TransactionInstruction {
  const address = associatedTokenAddress(args.owner, args.mint);

  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: address, isSigner: false, isWritable: true },
      { pubkey: args.owner, isSigner: false, isWritable: false },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([CREATE_IDEMPOTENT]),
  });
}

/**
 * TransferChecked rather than Transfer.
 *
 * The checked form makes the program verify the mint and the decimals against
 * what we believe them to be. Plain Transfer does not, so a wrong-decimals bug
 * would move a thousand times the intended amount and the chain would accept
 * it. The extra account is worth that.
 */
export function transferCheckedInstruction(args: {
  source: PublicKey;
  mint: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amount: bigint;
  decimals: number;
}): TransactionInstruction {
  if (args.amount <= 0n) throw new Error("Refusing to build a transfer of zero.");
  if (args.amount > 0xffff_ffff_ffff_ffffn) throw new Error("Amount does not fit in u64.");
  if (!Number.isInteger(args.decimals) || args.decimals < 0 || args.decimals > 9) {
    throw new Error("Decimals out of range.");
  }

  const data = Buffer.alloc(10);
  data.writeUInt8(TRANSFER_CHECKED, 0);
  data.writeBigUInt64LE(args.amount, 1);
  data.writeUInt8(args.decimals, 9);

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: args.source, isSigner: false, isWritable: true },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: args.destination, isSigner: false, isWritable: true },
      { pubkey: args.owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * USD to the token's base units, exactly.
 *
 * Takes a decimal string rather than a number: $0.07 is not representable as a
 * double, and `0.07 * 1e6` is 70000.00000000001. Rounding that gives the right
 * answer today and the wrong one for some other amount, so the conversion is
 * done on the digits instead.
 */
export function toBaseUnits(amount: string, decimals: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) throw new Error(`Not a plain decimal amount: ${amount}`);

  const [whole = "0", fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    // Silently truncating here would short the member by a fraction of a cent
    // on every payout, which is a bug that only shows up in aggregate.
    throw new Error(`${amount} has more precision than ${decimals} decimals can hold.`);
  }

  return BigInt(whole + fraction.padEnd(decimals, "0"));
}
