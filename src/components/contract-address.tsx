"use client";

import { useState } from "react";
import { TOKEN, explorerUrl } from "@/lib/social";
import { BRAND } from "@/lib/brand";

/**
 * The contract address, or an honest statement that there is not one yet.
 *
 * Two rules this follows, both of which most projects break:
 *
 * 1. No date. "Coming soon" on its own is a state; with a date attached it is
 *    a promise, and a missed one is the first thing people point at. The line
 *    below carries the part that actually protects people — where the address
 *    will appear, and that anything earlier is not ours.
 * 2. The full address, never truncated, with a copy button and an explorer
 *    link. A shortened address is the thing scammers exploit: 0xAB…CD matches
 *    thousands of contracts, and someone comparing only the ends buys the wrong
 *    token.
 */
export function ContractAddress() {
  const [copied, setCopied] = useState(false);
  const explorer = explorerUrl(TOKEN);

  async function copy() {
    if (!TOKEN.address) return;
    try {
      await navigator.clipboard.writeText(TOKEN.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked in some browsers without a user gesture chain, or
      // over http. The address is on screen in full either way, so there is
      // nothing to recover from — just do not claim it was copied.
      setCopied(false);
    }
  }

  if (!TOKEN.address) {
    return (
      <div className="rounded-card px-[18px] py-4 surface-inset">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="mn text-[12px] uppercase tracking-[0.08em] text-fg-4">
            {BRAND.ticker} contract
          </span>
          <span className="mn text-[13.5px] text-amber">Coming soon</span>
        </div>
        <p className="mt-2 max-w-[58ch] text-[12.5px] leading-[1.6] text-fg-3">
          There is no {BRAND.ticker} contract. When there is one, the full address appears here
          and nowhere else first — if you see an address for {BRAND.ticker} anywhere before it is
          on this page, it is not ours.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card px-[18px] py-4 surface-inset">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="mn text-[12px] uppercase tracking-[0.08em] text-fg-4">
          {BRAND.ticker} contract
        </span>
        <span className="mn text-[12px] text-fg-4">{TOKEN.chain}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Full address, never truncated — see the note above. */}
        <code className="mn min-w-0 flex-1 break-all rounded-soft bg-surf px-3 py-2 text-[12.5px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)]">
          {TOKEN.address}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-soft bg-surf-2 px-3 py-2 text-[12.5px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:bg-surf-3"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {explorer ? (
        <a
          href={explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[12px] text-ac-2 hover:underline"
        >
          Check it on the explorer
        </a>
      ) : null}
    </div>
  );
}
