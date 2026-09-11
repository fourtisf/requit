"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/wallet/address";

export type PayoutWallet = {
  id: string;
  chain: "SOLANA" | "BASE";
  address: string;
};

/**
 * One withdrawal request.
 *
 * The idempotency key is minted once when the form mounts and reused for every
 * submit from this form instance — that is what makes a double-click, a flaky
 * connection retried by the user, and a bfcache resubmit all resolve to the
 * same withdrawal instead of two. §6.1 calls this the single most important
 * guard in the system, and it only works if the key is stable across retries of
 * the same intent.
 */
export function WithdrawForm({
  wallets,
  available,
  minimum,
}: {
  wallets: PayoutWallet[];
  available: string;
  minimum: string;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ walletId, amount: amount.trim(), idempotencyKey: key }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not request that.");
        return;
      }

      setDone(
        payload.replayed
          ? "That request was already in. Nothing was sent twice."
          : `Requested $${payload.withdrawal.amount}.`,
      );
      router.refresh();
    } catch {
      setError("Could not reach the server. Your balance is unchanged.");
    } finally {
      setBusy(false);
    }
  }

  if (wallets.length === 0) {
    return (
      <p className="text-[13.5px] leading-[1.6] text-fg-3">
        Verify a wallet first. Withdrawals only go to an address you have proved you control.
      </p>
    );
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={`${fieldId}-wallet`} className="block text-[12.5px] text-fg-3">
        Destination
      </label>
      <select
        id={`${fieldId}-wallet`}
        value={walletId}
        onChange={(event) => setWalletId(event.target.value)}
        className="mn mt-2 w-full rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none"
      >
        {wallets.map((wallet) => (
          <option key={wallet.id} value={wallet.id}>
            {wallet.chain === "BASE" ? "Base · ETH" : "Solana · USDC"} —{" "}
            {shortAddress(wallet.address)}
          </option>
        ))}
      </select>

      <label htmlFor={`${fieldId}-amount`} className="mt-4 block text-[12.5px] text-fg-3">
        Amount in USD
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id={`${fieldId}-amount`}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
          inputMode="decimal"
          placeholder={minimum}
          className="mn w-[140px] rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
        />
        <button
          type="button"
          onClick={() => setAmount(available)}
          className="text-[12.5px] text-fg-3 underline underline-offset-4 transition-colors hover:text-fg"
        >
          all of it (${available})
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || amount.trim() === "" || done !== null}>
          {busy ? "Requesting…" : "Request withdrawal"}
        </Button>
        {error ? <span className="text-[12.5px] text-amber">{error}</span> : null}
        {done ? <span className="text-[12.5px] text-ac-2">{done}</span> : null}
      </div>

      <p className="mt-4 text-[12px] leading-[1.55] text-fg-4">
        Minimum ${minimum}. Amounts are in USD; Solana pays in USDC and Base pays the equivalent
        in ETH at the rate when it is sent.
      </p>
    </form>
  );
}
