"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MAX_EVIDENCE } from "@/lib/disputes";

const NETWORKS = ["TOROX", "CPX", "LOOTABLY", "TIMEWALL"] as const;

export function DisputeForm() {
  const router = useRouter();
  const fieldId = useId();
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>("TOROX");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    // One link per line: a comma-separated field silently breaks on URLs that
    // contain commas, which query strings often do.
    const evidenceUrls = evidence
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network,
          claimedAmount: amount.trim(),
          reason: reason.trim(),
          evidenceUrls,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not open that.");
        return;
      }

      setDone(true);
      setAmount("");
      setReason("");
      setEvidence("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <p className="text-[13.5px] text-ac-2">Opened. It is in the queue below.</p>
        <Button variant="secondary" className="mt-4" onClick={() => setDone(false)}>
          Open another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor={`${fieldId}-network`} className="block text-[12.5px] text-fg-3">
        Which network
      </label>
      <select
        id={`${fieldId}-network`}
        value={network}
        onChange={(event) => setNetwork(event.target.value as (typeof NETWORKS)[number])}
        className="mn mt-2 w-full rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none"
      >
        {NETWORKS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <label htmlFor={`${fieldId}-amount`} className="mt-4 block text-[12.5px] text-fg-3">
        What you expected to be paid, in USD
      </label>
      <input
        id={`${fieldId}-amount`}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        required
        inputMode="decimal"
        placeholder="12.50"
        className="mn mt-2 w-[140px] rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
      />

      <label htmlFor={`${fieldId}-reason`} className="mt-4 block text-[12.5px] text-fg-3">
        What happened
      </label>
      <textarea
        id={`${fieldId}-reason`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        required
        minLength={20}
        rows={4}
        placeholder="Which task, what you completed, and when. The more specific, the faster the network can check it."
        className="mt-2 w-full resize-y rounded-soft bg-surf px-3 py-2 text-[13px] leading-[1.55] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
      />

      <label htmlFor={`${fieldId}-evidence`} className="mt-4 block text-[12.5px] text-fg-3">
        Evidence — screenshot links, one per line (optional)
      </label>
      <textarea
        id={`${fieldId}-evidence`}
        value={evidence}
        onChange={(event) => setEvidence(event.target.value)}
        rows={2}
        placeholder="https://…"
        className="mn mt-2 w-full resize-y rounded-soft bg-surf px-3 py-2 text-[12.5px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
      />
      <p className="mt-1 text-[12px] text-fg-4">
        Up to {MAX_EVIDENCE}. Upload the image anywhere you like and paste the link — we do not
        want a copy of your files.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Opening…" : "Open dispute"}
        </Button>
        {error ? <span className="text-[12.5px] text-amber">{error}</span> : null}
      </div>
    </form>
  );
}
