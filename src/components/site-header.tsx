import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand-mark";
import { ContractChip } from "@/components/contract-chip";
import { SocialNav } from "@/components/social-nav";

/**
 * The public header, shared by the landing page and any other page a visitor
 * can reach without an account.
 *
 * Extracted rather than copied: a second inline version is a second place for
 * the sign-in link to be forgotten, and that link is the only way in that is
 * not reachable by scrolling.
 */
export function SiteHeader({ links = true }: { links?: boolean }) {
  return (
    <header className="shell pt-12">
      <div className="flex flex-wrap items-center gap-4">
        <BrandLockup href="/" />
        <nav className="ml-auto flex items-center gap-0.5">
          {/* The section links are hidden on a phone. They are anchors to
              content the reader scrolls past anyway, and at 400px they push the
              one thing that is not reachable by scrolling — the way in — off
              the right edge. */}
          {links ? (
            <span className="hidden gap-0.5 sm:flex">
              {[
                { href: "/#how", label: "How it works" },
                { href: "/#tasks", label: "The work" },
                { href: "/play", label: "Play" },
                { href: "/#timing", label: "Timing" },
                { href: "/#faq", label: "Questions" },
                { href: "/proof", label: "Proof" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-[13px] py-[7px] text-[13.5px] text-fg-3 transition-colors hover:bg-surf-2 hover:text-fg"
                >
                  {link.label}
                </a>
              ))}
            </span>
          ) : null}

          {/* Top right is where people look for the contract address and the
              accounts, and looking and finding nothing is what makes a project
              read as abandoned or as someone else's to impersonate. All three
              stay visible on a phone: unlike the section anchors, a chip and
              two 30px icons do not crowd the sign-in button.

              Signposts, not content. Both land on #community — the token is not
              what this product is, and a price-ticker-shaped block in the
              header would say it is. */}
          <ContractChip className="ml-1" />
          <SocialNav />

          {/* Somebody who already has an account looks top right, which is
              where every site puts this. Without it the only way in was the
              hero button, and that reads as "make a second account". */}
          <Link
            href="/signin"
            className="ml-1.5 rounded-lg bg-surf-2 px-[15px] py-[7px] text-[13.5px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:bg-surf-3"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
