import Link from "next/link";
import { TOKEN } from "@/lib/social";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

/**
 * The header's answer to "where is the contract address".
 *
 * It is a signpost, never the address itself. Even once TOKEN.address is set
 * this chip keeps pointing at #community rather than printing it, because an
 * address has to be shown in full to be safe and a full address does not fit in
 * a header — and the shortened form is precisely what gets people to buy the
 * wrong token: 0xAB…CD matches thousands of contracts, so someone comparing
 * only the ends compares nothing.
 *
 * So: one click from the top of the page to the block that shows it whole, with
 * a copy button and an explorer link. While there is no contract, the same
 * click lands on the sentence that says so.
 */
export function ContractChip({ className }: { className?: string }) {
  const pending = TOKEN.address === null;

  return (
    <Link
      href="/#community"
      aria-label={
        pending
          ? `${BRAND.ticker} contract — not deployed yet`
          : `${BRAND.ticker} contract address`
      }
      className={cn(
        "mn inline-flex items-center gap-1.5 rounded-lg px-[10px] py-[6px] text-[12px] transition-colors hover:bg-surf-2",
        pending ? "text-fg-4 hover:text-fg-2" : "text-fg-3 hover:text-fg",
        className,
      )}
    >
      <span className="uppercase tracking-[0.06em]">CA</span>
      {pending ? (
        <span className="uppercase tracking-[0.06em] text-amber">Soon</span>
      ) : (
        <span className="text-fg-4">{BRAND.ticker}</span>
      )}
    </Link>
  );
}
