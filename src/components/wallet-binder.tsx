"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Chain = "SOLANA" | "BASE";

type Stage =
  | { step: "idle" }
  | { step: "signing"; nonce: string; message: string; address: string }
  | { step: "done"; address: string };

const CHAINS: { value: Chain; label: string; hint: string }[] = [
  { value: "BASE", label: "Base", hint: "ETH · an address starting 0x" },
  { value: "SOLANA", label: "Solana", hint: "USDC · a base58 address" },
];

/**
 * Binds a wallet by signature, in two steps the member can see.
 *
 * The message is shown in full before anything is signed. A product that asks
 * people to sign text they cannot read is training them to approve whatever a
 * wallet shows them, and that habit is what drains wallets elsewhere.
 *
 * There is no wallet-connect integration here on purpose: that pulls a large
 * dependency into a page that handles payouts, and copy-and-paste of a
 * signature works with every wallet including hardware ones. It can be added
 * later without changing anything the server does.
 */
export function WalletBinder() {
  const router = useRouter();
  const [chain, setChain] = useState<Chain>("BASE");
  const [address, setAddress] = useState("");
  const [signature, setSignature] = useState("");
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/wallet/nonce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chain, address }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not start.");
        return;
      }
      setStage({
        step: "signing",
        nonce: payload.nonce,
        message: payload.message,
        address: payload.address,
      });
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(event: React.FormEvent) {
    event.preventDefault();
    if (stage.step !== "signing") return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/wallet/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nonce: stage.nonce, signature: signature.trim() }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not verify.");
        // The nonce is burned on any attempt, so there is nothing to retry with
        // — send them back rather than leaving a dead form on screen.
        setStage({ step: "idle" });
        setSignature("");
        return;
      }

      setStage({ step: "done", address: payload.wallet.address });
      setSignature("");
      setAddress("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (stage.step === "done") {
    return (
      <div>
        <p className="text-[13.5px] text-ac-2">Wallet verified.</p>
        <p className="mn mt-1 break-all text-[12.5px] text-fg-3">{stage.address}</p>
        <Button variant="secondary" className="mt-4" onClick={() => setStage({ step: "idle" })}>
          Add another
        </Button>
      </div>
    );
  }

  if (stage.step === "signing") {
    return (
      <form onSubmit={finish}>
        <p className="text-[13px] leading-[1.6] text-fg-2">
          Sign this exact text with the wallet that owns{" "}
          <span className="mn break-all">{stage.address}</span>, then paste the signature below.
          Signing is free and moves nothing.
        </p>

        <pre className="mn mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-soft bg-surf px-3 py-3 text-[11.5px] leading-[1.55] text-fg-3 shadow-[inset_0_0_0_1px_var(--color-bd)]">
          {stage.message}
        </pre>

        <textarea
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          required
          rows={3}
          placeholder="Paste the signature"
          className="mn mt-3 w-full resize-y break-all rounded-soft bg-surf px-3 py-2 text-[12.5px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy || signature.trim() === ""}>
            {busy ? "Checking…" : "Verify"}
          </Button>
          <button
            type="button"
            onClick={() => setStage({ step: "idle" })}
            className="text-[12.5px] text-fg-3 transition-colors hover:text-fg"
          >
            Cancel
          </button>
          {error ? <span className="text-[12.5px] text-amber">{error}</span> : null}
        </div>

        <p className="mt-3 text-[12px] leading-[1.5] text-fg-4">
          This request expires in 10 minutes and works once. If it fails you start again — that
          is what stops a signature being replayed.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={start}>
      <div className="flex flex-wrap gap-1.5">
        {CHAINS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setChain(option.value)}
            className={
              chain === option.value
                ? "rounded-full bg-surf-3 px-[13px] py-[7px] text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
                : "rounded-full px-[13px] py-[7px] text-[13px] text-fg-3 transition-colors hover:bg-surf-2"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[12px] text-fg-4">
        {CHAINS.find((option) => option.value === chain)?.hint}
      </p>

      <input
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        required
        spellCheck={false}
        autoComplete="off"
        placeholder={chain === "BASE" ? "0x…" : "Base58 address"}
        className="mn mt-3 w-full rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || address.trim() === ""}>
          {busy ? "Checking…" : "Continue"}
        </Button>
        {error ? <span className="text-[12.5px] text-amber">{error}</span> : null}
      </div>

      <p className="mt-4 text-[12px] leading-[1.55] text-fg-4">
        We never ask for a seed phrase, and we never ask you to send a transaction to prove
        ownership. A signature is enough, and it costs nothing.
      </p>
    </form>
  );
}
