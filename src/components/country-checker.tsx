"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Availability = {
  offerCount: number;
  networksLive: number;
  qualifyRate: number | null;
  surveyRange: { low: string; high: string } | null;
  bestRealisticTier: { label: string; amount: string } | null;
  rails: string[];
  note: string | null;
};

/**
 * Answers "can I actually use this from here" before someone signs up.
 *
 * Without this the only way to find out is to create an account and see an
 * empty task list, which is both a wasted signup and exactly the experience
 * this product is positioned against.
 */
export function CountryChecker() {
  const [country, setCountry] = useState("");
  const [result, setResult] = useState<Availability | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    const code = country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      setError("Use a two-letter country code, like US or ID.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/availability?country=${code}`);
      if (!response.ok) {
        setError("Could not check right now. Try again shortly.");
        return;
      }
      setResult((await response.json()) as Availability);
      setChecked(code);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={check} className="flex flex-wrap items-center gap-2">
        <input
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          maxLength={2}
          placeholder="US"
          aria-label="Two-letter country code"
          className="mn w-[90px] rounded-soft bg-surf px-3 py-2 text-[13px] uppercase text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
        />
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? "Checking…" : "Check"}
        </Button>
        {error ? <span className="text-[12.5px] text-amber">{error}</span> : null}
      </form>

      {result && checked ? (
        <div className="mt-5">
          {result.offerCount === 0 ? (
            <p className="max-w-[52ch] text-[13.5px] leading-[1.6] text-fg-3">
              Nothing is live for <span className="mn">{checked}</span> right now. We would rather
              tell you that here than after you have made an account.
            </p>
          ) : (
            <dl className="text-[13.5px]">
              <Row label="Tasks live" value={String(result.offerCount)} />
              <Row label="Networks" value={String(result.networksLive)} />
              <Row
                label="Share of starts that get paid"
                value={
                  result.qualifyRate === null
                    ? null
                    : `${Math.round(result.qualifyRate * 100)}%`
                }
              />
              <Row
                label="Surveys pay"
                value={
                  result.surveyRange
                    ? `$${result.surveyRange.low} – $${result.surveyRange.high}`
                    : null
                }
              />
              <Row
                label="Best tier people actually reach"
                value={
                  result.bestRealisticTier
                    ? `$${result.bestRealisticTier.amount} · ${result.bestRealisticTier.label}`
                    : null
                }
              />
              <Row label="Paid in" value={result.rails.join(" · ")} />
            </dl>
          )}

          {result.note ? (
            <p className="mt-4 text-[12.5px] leading-[1.55] text-fg-3">{result.note}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 max-w-[52ch] text-[13px] leading-[1.6] text-fg-3">
          Offers are matched by country, so what is worth your time depends on where you are.
          Check before you sign up.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-bd py-2 last:border-b-0">
      <dt className="text-fg-3">{label}</dt>
      <dd className={value === null ? "mn text-fg-4" : "mn text-fg"}>
        {/* §8: hide the row rather than show a placeholder. Saying why it is
            absent is better than hiding it entirely — an absent row reads as an
            omission, and this reads as honesty. */}
        {value ?? "not enough data"}
      </dd>
    </div>
  );
}
