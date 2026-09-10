import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { LEGAL, operatorName } from "@/lib/legal";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#how", label: "How it works" },
      { href: "/#compare", label: "Why us" },
      { href: "/#timing", label: "Payout timing" },
      { href: "/#faq", label: "Questions" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/reward-policy", label: "Reward policy" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-[clamp(48px,7vw,86px)] border-t border-bd">
      <div className="shell py-11">
        <div className="grid grid-cols-2 gap-7 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-2">
            <p className="text-[13px] font-semibold tracking-[-0.025em]">{BRAND.name}</p>
            <p className="mt-2 max-w-[38ch] text-[12.5px] leading-[1.6] text-fg-3">
              Advertiser-funded work, paid the same day.
            </p>
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="mn mt-3 inline-block text-[12.5px] text-fg-3 transition-colors hover:text-fg"
            >
              {BRAND.supportEmail}
            </a>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="mb-2 text-[12.5px] font-semibold">{column.heading}</p>
              {column.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block py-[5px] text-[13.5px] text-fg-3 transition-colors hover:text-fg"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/*
          The disclaimer the prototype carried, minus the parts that were only
          true of a prototype. The network names are here because naming them
          without saying what they are would imply a sponsorship that does not
          exist.
        */}
        <p className="mt-8 max-w-[96ch] text-[12px] leading-[1.6] text-fg-4">
          CPX Research, Lootably, TimeWall and Torox are independent offer providers, not sponsors
          or employers of {BRAND.name}, and are named to describe how the service works. A listed
          reward is payment for completing every required milestone; it is not guaranteed income
          and it is not employment. {BRAND.ticker} is not offered here, and nothing on this site is
          an offer to sell a security or an investment of any kind.
        </p>

        <p className="mt-4 text-[12px] text-fg-4">
          © {new Date().getFullYear()} {operatorName()}
          {LEGAL.jurisdiction ? ` · ${LEGAL.jurisdiction}` : ""}
        </p>
      </div>
    </footer>
  );
}
