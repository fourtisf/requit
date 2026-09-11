import { verifyMessage } from "viem";
import nacl from "tweetnacl";
import bs58 from "bs58";
import type { Chain } from "@prisma/client";
import { bindingMessage } from "@/lib/wallet/message";

export type VerifyOutcome = "ok" | "bad-signature" | "malformed-signature";

export type VerifyInput = {
  chain: Chain;
  address: string;
  nonce: string;
  issuedAt: string;
  signature: string;
};

/**
 * Does this signature prove control of this address?
 *
 * The message is rebuilt here from the stored nonce — the client never supplies
 * the bytes that get verified. A client-supplied message would let someone
 * present a signature they obtained for entirely different text (a transaction
 * approval on some other site, say) and have us accept it as a binding.
 */
export async function verifyBinding(input: VerifyInput): Promise<VerifyOutcome> {
  const message = bindingMessage({
    chain: input.chain,
    address: input.address,
    nonce: input.nonce,
    issuedAt: input.issuedAt,
  });

  return input.chain === "BASE"
    ? verifyEvm(input.address, message, input.signature)
    : verifySolana(input.address, message, input.signature);
}

async function verifyEvm(
  address: string,
  message: string,
  signature: string,
): Promise<VerifyOutcome> {
  if (!/^0x[0-9a-fA-F]+$/.test(signature)) return "malformed-signature";

  try {
    // verifyMessage applies the EIP-191 prefix and, for a contract account,
    // falls back to an EIP-1271 call — so a smart-contract wallet works without
    // a separate path, which §5 asks for if it is cheap. It is.
    const ok = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
    return ok ? "ok" : "bad-signature";
  } catch {
    // A malformed signature makes viem throw rather than return false. That is
    // still a refusal, not an outage, so it must not surface as a 500.
    return "malformed-signature";
  }
}

function verifySolana(address: string, message: string, signature: string): VerifyOutcome {
  let publicKey: Uint8Array;
  let signatureBytes: Uint8Array;

  try {
    publicKey = bs58.decode(address);
    signatureBytes = bs58.decode(signature);
  } catch {
    return "malformed-signature";
  }

  if (publicKey.length !== 32) return "malformed-signature";
  if (signatureBytes.length !== 64) return "malformed-signature";

  try {
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      signatureBytes,
      publicKey,
    );
    return ok ? "ok" : "bad-signature";
  } catch {
    return "malformed-signature";
  }
}
