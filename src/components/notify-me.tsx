"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The way out of the dead end.
 *
 * A member whose country has no inventory used to read "nothing live yet" and
 * have nowhere to go. This turns that page into a commitment in both
 * directions: they get told when it changes, and we learn where the demand is —
 * which is the evidence a network asks for before approving a publisher.
 */
export function NotifyMe({
  countryCode,
  alreadyWaiting,
  waiting,
}: {
  countryCode: string;
  alreadyWaiting: boolean;
  waiting: number;
}) {
  const [done, setDone] = useState(alreadyWaiting);
  const [count, setCount] = useState(waiting);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function register() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/interest", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not do that.");
        return;
      }
      setDone(true);
      setCount(payload.waiting);
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-5">
        <p className="text-[13.5px] text-ac-2">
          We will email you when tasks go live in {countryCode}.
        </p>
        <p className="mt-1.5 text-[12.5px] leading-[1.6] text-fg-3">
          {count === 1
            ? "You are the first person waiting here."
            : `${count} people are waiting for ${countryCode}.`}{" "}
          That number is what we show networks when we ask them to open your country — so asking
          is the most useful thing you can do right now.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={register} disabled={busy}>
          {busy ? "…" : `Email me when ${countryCode} opens`}
        </Button>
        {error ? <span className="text-[12.5px] text-amber">{error}</span> : null}
      </div>
      {count > 0 ? (
        <p className="mt-2.5 text-[12.5px] text-fg-3">
          {count} {count === 1 ? "person is" : "people are"} already waiting for {countryCode}.
        </p>
      ) : null}
    </div>
  );
}
